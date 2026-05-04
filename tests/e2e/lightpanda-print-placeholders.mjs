import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

const lightpandaBin = process.env.LIGHTPANDA_BIN || "lightpanda";
const appUrl =
  process.env.POKEVAULT_E2E_URL ||
  process.env.POKEVault_E2E_URL ||
  "http://127.0.0.1:8765/";
const cdpPort = Number(process.env.LIGHTPANDA_CDP_PORT || "9222");
const cdpHost = "127.0.0.1";
const e2eBinderId = "e2e-family-placeholders";
const e2eRuleId = "e2e-base-regional";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appBaseUrl() {
  const url = new URL(appUrl);
  url.hash = "";
  url.search = "";
  return url;
}

function appApiUrl(path) {
  return new URL(path, appBaseUrl()).href;
}

async function fetchJson(path, options = {}) {
  const res = await fetch(appApiUrl(path), options);
  if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
  return res.json();
}

async function putJson(path, body) {
  return fetchJson(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function e2eFormRule() {
  return {
    id: e2eRuleId,
    label: "E2E base + regional",
    include_base: true,
    include_mega: false,
    include_gigamax: false,
    include_regional: true,
    include_other_named_forms: false,
  };
}

function e2eBinder() {
  return {
    id: e2eBinderId,
    name: "E2E familles",
    cols: 3,
    rows: 3,
    sheet_count: 10,
    form_rule_id: e2eRuleId,
    organization: "family",
  };
}

async function seedBinderConfig() {
  await fetchJson("/api/health");
  const previousConfig = await fetchJson("/api/binder/config");
  const previousPlacements = await fetchJson("/api/binder/placements");
  const snapshot = { previousConfig, previousPlacements };
  const config = {
    version: 1,
    convention: previousConfig.convention || "sheet_recto_verso",
    binders: [
      ...(Array.isArray(previousConfig.binders)
        ? previousConfig.binders.filter((binder) => binder?.id !== e2eBinderId)
        : []),
      e2eBinder(),
    ],
    form_rules: [
      ...(Array.isArray(previousConfig.form_rules)
        ? previousConfig.form_rules.filter((rule) => rule?.id !== e2eRuleId)
        : []),
      e2eFormRule(),
    ],
  };
  const placements = {
    version: 1,
    by_binder: {
      ...(previousPlacements.by_binder || {}),
      [e2eBinderId]: {},
    },
  };
  try {
    await putJson("/api/binder/config", config);
    await putJson("/api/binder/placements", placements);
  } catch (err) {
    await restoreBinderConfig(snapshot);
    throw err;
  }
  return snapshot;
}

async function restoreBinderConfig(snapshot) {
  if (!snapshot) return;
  const errors = [];
  try {
    await putJson("/api/binder/config", snapshot.previousConfig);
  } catch (err) {
    errors.push(err);
  }
  try {
    await putJson("/api/binder/placements", snapshot.previousPlacements);
  } catch (err) {
    errors.push(err);
  }
  if (errors.length) {
    throw new Error(`Failed to restore binder state: ${errors.map((err) => err.message).join("; ")}`);
  }
}

function ensurePortAvailable() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (err) => {
      reject(new Error(`CDP port ${cdpPort} is not available: ${err.message}`));
    });
    server.once("listening", () => {
      server.close(() => resolve());
    });
    server.listen(cdpPort, cdpHost);
  });
}

function startLightpanda() {
  const proc = spawn(
    lightpandaBin,
    ["serve", "--host", cdpHost, "--port", String(cdpPort)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        LIGHTPANDA_DISABLE_TELEMETRY: process.env.LIGHTPANDA_DISABLE_TELEMETRY || "true",
      },
    },
  );
  let output = "";
  proc.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  proc.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const startupError = new Promise((_, reject) => {
    proc.once("error", (err) => {
      reject(new Error(`Could not start Lightpanda (${lightpandaBin}): ${err.message}`));
    });
  });
  return {
    proc,
    startupError,
    output() {
      return output.trim();
    },
  };
}

async function waitForCdp(lightpanda) {
  let lastError = null;
  for (let i = 0; i < 80; i += 1) {
    if (lightpanda.proc.exitCode !== null) {
      throw new Error(`Lightpanda exited early (${lightpanda.proc.exitCode}): ${lightpanda.output()}`);
    }
    try {
      const res = await fetch(`http://${cdpHost}:${cdpPort}/json/version`);
      if (res.ok) {
        if (lightpanda.proc.exitCode !== null) {
          throw new Error(`Lightpanda exited early (${lightpanda.proc.exitCode}): ${lightpanda.output()}`);
        }
        const meta = await res.json();
        return meta.webSocketDebuggerUrl || `ws://${cdpHost}:${cdpPort}/`;
      }
    } catch (err) {
      lastError = err;
    }
    await wait(100);
  }
  throw new Error(`Lightpanda CDP server did not start: ${lastError?.message || lightpanda.output()}`);
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (!msg.id || !pending.has(msg.id)) return;
    const request = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(request.timer);
    if (msg.error) {
      request.reject(new Error(`${request.method}: ${msg.error.message || JSON.stringify(msg.error)}`));
    } else {
      request.resolve(msg.result || {});
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener("error", reject, { once: true });
    ws.addEventListener("open", () => {
      const send = (method, params = {}, sessionId = null, timeoutMs = 10000) => new Promise((done, fail) => {
        const id = seq += 1;
        const timer = setTimeout(() => {
          pending.delete(id);
          fail(new Error(`${method} timed out`));
        }, timeoutMs);
        pending.set(id, { method, resolve: done, reject: fail, timer });
        ws.send(JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }));
      });
      resolve({ ws, send });
    }, { once: true });
  });
}

async function createPage(send) {
  const target = await send("Target.createTarget", { url: "about:blank" });
  assert.ok(target.targetId, "Lightpanda did not return a target id");
  const attached = await send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  assert.ok(attached.sessionId, "Lightpanda did not return a session id");
  await send("Runtime.enable", {}, attached.sessionId).catch(() => {});
  await send("Page.enable", {}, attached.sessionId).catch(() => {});
  return attached.sessionId;
}

async function evaluate(send, sessionId, expression, timeoutMs = 30000) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  }, sessionId, timeoutMs);
  if (result.exceptionDetails) {
    const exception = result.exceptionDetails.exception;
    throw new Error(exception?.description || exception?.value || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function waitForEval(send, sessionId, expression, label, timeoutMs = 20000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await evaluate(send, sessionId, expression, 5000);
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await wait(100);
  }
  throw new Error(`${label} did not become ready${lastError ? `: ${lastError.message}` : ""}`);
}

async function setRoute(send, sessionId, hash) {
  await evaluate(
    send,
    sessionId,
    `(() => {
      location.hash = ${JSON.stringify(hash)};
      window.applyPokedexAppRoute?.();
      return location.hash;
    })()`,
  );
  await wait(100);
}

async function changeSelect(send, sessionId, selector, value) {
  return evaluate(
    send,
    sessionId,
    `(() => {
      const select = document.querySelector(${JSON.stringify(selector)});
      if (!select) throw new Error("Missing select ${selector}");
      if (!Array.from(select.options || []).some((option) => option.value === ${JSON.stringify(value)})) {
        throw new Error("${selector} has no option ${value}");
      }
      select.value = ${JSON.stringify(value)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return select.value;
    })()`,
  );
}

async function runBrowserWorkflow(wsUrl) {
  const { ws, send } = await connectCdp(wsUrl);
  try {
    const sessionId = await createPage(send);
    const url = new URL(appUrl);
    url.hash = "#/liste";
    await send("Page.navigate", { url: url.href }, sessionId, 10000);
    await wait(1000);
    await waitForEval(send, sessionId, "document.readyState !== 'loading'", "page document");

    await setRoute(send, sessionId, "#/liste");
    await waitForEval(
      send,
      sessionId,
      "Boolean(window.PokedexCollection?.allPokemon?.length)",
      "collection data",
    );
    await waitForEval(
      send,
      sessionId,
      "Boolean(window.PokevaultArtwork?.modes?.some((mode) => mode.id === 'sprite_gen2'))",
      "generation sprite artwork modes",
    );

    await setRoute(send, sessionId, "#/settings");
    await waitForEval(
      send,
      sessionId,
      "Boolean(document.querySelector(\"#settingsArtworkSelect option[value='sprite_gen2']\"))",
      "settings artwork select",
    );
    await changeSelect(send, sessionId, "#settingsArtworkSelect", "sprite_gen2");
    await waitForEval(
      send,
      sessionId,
      "window.PokevaultArtwork?.mode === 'sprite_gen2'",
      "global sprite mode",
    );

    await setRoute(send, sessionId, "#/classeur");
    await waitForEval(send, sessionId, "Boolean(document.querySelector('#binderPagesHost'))", "binder host");
    await waitForEval(
      send,
      sessionId,
      "Boolean(document.querySelector('#binderCollectionShell') && !document.querySelector('#binderCollectionShell').hidden)",
      "binder shell",
    );
    await waitForEval(
      send,
      sessionId,
      `Boolean(document.querySelector("#binderIdSelect option[value='${e2eBinderId}']"))`,
      "E2E binder option",
    );
    await changeSelect(send, sessionId, "#binderIdSelect", e2eBinderId);
    await wait(100);
    let binderReserved = 0;
    for (let i = 0; i < 24; i += 1) {
      binderReserved = await evaluate(
        send,
        sessionId,
        "document.querySelectorAll('.card--reserved-slot').length",
      );
      if (binderReserved > 0) break;
      await evaluate(send, sessionId, "document.querySelector('#binderFaceNext')?.click(); true");
      await wait(80);
    }
    assert.ok(binderReserved > 0, "binder family reserved slots were not visible after paging");

    await setRoute(send, sessionId, "#/print");
    await waitForEval(send, sessionId, "Boolean(document.querySelector('#printGroupSelect'))", "print controls");
    await changeSelect(send, sessionId, "#printFilterSelect", "all");
    await changeSelect(send, sessionId, "#printGroupSelect", "placeholders");
    await waitForEval(
      send,
      sessionId,
      "Boolean(document.querySelector('.print-placeholder-card'))",
      "placeholder cards",
    );
    const printState = await evaluate(
      send,
      sessionId,
      `(() => {
        const placeholderCards = [...document.querySelectorAll(".print-placeholder-card")];
        const metadata = placeholderCards
          .map((card) => card.querySelector("small")?.textContent || "")
          .find((text) => /P\\d+/.test(text) && /case \\d+/.test(text));
        return {
          placeholderCards: placeholderCards.length,
          printReserved: document.querySelectorAll(".print-placeholder-card--reserved").length,
          metadata: metadata || "",
        };
      })()`,
    );
    assert.ok(printState.metadata, "placeholder cards did not expose page and slot metadata");

    await waitForEval(
      send,
      sessionId,
      "Boolean(document.querySelector(\"#printArtworkSelect option[value='sprite_gen1']\"))",
      "print artwork sprite mode",
    );
    await changeSelect(send, sessionId, "#printArtworkSelect", "sprite_gen1");
    await waitForEval(
      send,
      sessionId,
      "document.querySelector('#printArtworkSelect')?.value === 'sprite_gen1'",
      "print artwork selection",
    );
    const finalState = await evaluate(
      send,
      sessionId,
      `(() => ({
        artworkMode: window.PokevaultArtwork?.mode,
        printArtworkMode: document.querySelector("#printArtworkSelect")?.value,
      }))()`,
    );
    return { ...printState, ...finalState, binderReserved };
  } finally {
    ws.close();
  }
}

async function main() {
  let snapshot = null;
  let lightpanda = null;
  try {
    await fetchJson("/api/health");
    await ensurePortAvailable();
    lightpanda = startLightpanda();
    const wsUrl = await Promise.race([waitForCdp(lightpanda), lightpanda.startupError]);
    snapshot = await seedBinderConfig();
    const result = await runBrowserWorkflow(wsUrl);
    assert.equal(result.artworkMode, "sprite_gen2");
    assert.equal(result.printArtworkMode, "sprite_gen1");
    assert.ok(result.binderReserved > 0, "expected visible binder reserved slots");
    assert.ok(result.placeholderCards > 0, "expected printable placeholder cards");
    assert.ok(result.printReserved > 0, "expected printable reserved placeholders");
    assert.match(result.metadata, /case \d+/);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    if (snapshot) {
      try {
        await restoreBinderConfig(snapshot);
        snapshot = null;
      } catch (restoreErr) {
        err.message = `${err.message}\nAlso failed to restore binder state: ${restoreErr.message}`;
      }
    }
    throw err;
  } finally {
    if (lightpanda?.proc && lightpanda.proc.exitCode === null) {
      lightpanda.proc.kill("SIGTERM");
    }
    if (snapshot) {
      await restoreBinderConfig(snapshot).catch((err) => {
        console.error(err.stack || err.message);
        process.exitCode = 1;
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
