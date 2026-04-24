(function initProfiles() {
  "use strict";

  const ENDPOINT = "/api/profiles";
  let cache = { active_id: "default", profiles: [] };
  const subscribers = new Set();

  async function refresh() {
    try {
      const r = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
      if (!r.ok) return cache;
      cache = await r.json();
      notify();
      return cache;
    } catch {
      return cache;
    }
  }

  async function create(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new Error("name required");
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!r.ok) throw new Error(`create failed (${r.status})`);
    await refresh();
    return r.json();
  }

  async function setActive(id) {
    const r = await fetch(`${ENDPOINT}/active`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) throw new Error(`switch failed (${r.status})`);
    await refresh();
    return r.json();
  }

  async function remove(id) {
    if (id === "default") throw new Error("cannot delete default profile");
    const r = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!r.ok) throw new Error(`delete failed (${r.status})`);
    await refresh();
    return r.json();
  }

  function getCache() {
    return cache;
  }

  function activeId() {
    return cache.active_id;
  }

  function activeProfile() {
    return cache.profiles.find((p) => p.id === cache.active_id) || null;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    subscribers.add(fn);
    try {
      fn(cache);
    } catch {
      /* defensive — subscriber threw on initial fanout */
    }
    return () => subscribers.delete(fn);
  }

  function notify() {
    for (const fn of subscribers) {
      try {
        fn(cache);
      } catch {
        /* ignore subscriber errors */
      }
    }
  }

  window.PokevaultProfiles = {
    refresh,
    create,
    setActive,
    remove,
    get: getCache,
    activeId,
    activeProfile,
    subscribe,
  };

  refresh();
})();
