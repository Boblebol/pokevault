/**
 * Pokevault — lightweight toast host (roadmap F12).
 *
 * Non-blocking notifications used by badge unlocks and other
 * asynchronous successes. Toasts are announced via ``aria-live``
 * so screen readers are informed without interrupting the flow.
 *
 * Usage
 * -----
 *     PokevaultToast.show("Badge débloqué", "Century", { icon: "military_tech" });
 *     PokevaultToast.show("Simple message"); // accepts (title, description?)
 */
(function initToast() {
  "use strict";

  const DEFAULT_DURATION = 5000;
  const MAX_VISIBLE = 3;

  function ensureHost() {
    let host = document.getElementById("pokevaultToastHost");
    if (host) return host;
    host = document.createElement("div");
    host.id = "pokevaultToastHost";
    host.className = "toast-host";
    host.setAttribute("role", "region");
    host.setAttribute("aria-label", "Notifications");
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
    return host;
  }

  function trimOldest(host) {
    while (host.children.length > MAX_VISIBLE) {
      host.firstElementChild?.remove();
    }
  }

  function show(title, description = "", options = {}) {
    if (typeof document === "undefined") return null;
    const host = ensureHost();
    const el = document.createElement("div");
    el.className = "toast toast--enter";
    if (options.tone === "error") el.classList.add("toast--error");
    else if (options.tone === "ok" || options.tone === "success") {
      el.classList.add("toast--ok");
    }

    if (options.icon) {
      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined toast__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = String(options.icon);
      el.append(icon);
    }

    const body = document.createElement("div");
    body.className = "toast__body";
    const t = document.createElement("div");
    t.className = "toast__title";
    t.textContent = String(title || "");
    body.append(t);
    if (description) {
      const d = document.createElement("div");
      d.className = "toast__desc";
      d.textContent = String(description);
      body.append(d);
    }
    el.append(body);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast__close";
    close.setAttribute("aria-label", "Fermer la notification");
    close.textContent = "×";
    close.addEventListener("click", () => dismiss(el));
    el.append(close);

    host.append(el);
    trimOldest(host);

    const duration = Number.isFinite(options.duration)
      ? Math.max(1000, options.duration)
      : DEFAULT_DURATION;
    const timer = setTimeout(() => dismiss(el), duration);
    el._timer = timer;

    requestAnimationFrame(() => el.classList.remove("toast--enter"));
    return el;
  }

  function dismiss(el) {
    if (!el || !el.parentNode) return;
    clearTimeout(el._timer);
    el.classList.add("toast--leave");
    setTimeout(() => el.remove(), 220);
  }

  window.PokevaultToast = { show, dismiss };
})();
