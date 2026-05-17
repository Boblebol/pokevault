(function initArtwork() {
  "use strict";

  function normalizeDefault(p) {
    const raw = String(p?.image || "");
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  function resolve(p) {
    return { src: normalizeDefault(p), fallbacks: [] };
  }

  function attach(img, resolved) {
    if (!img || !resolved) return;
    img.src = resolved.src;
  }

  window.PokevaultArtwork = {
    resolve,
    attach,
  };
})();
