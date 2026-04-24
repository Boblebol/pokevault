/**
 * Keyboard shortcuts (F06).
 *
 * Global bindings on the list view:
 *   "/"  focus the search input
 *   Esc  blur input / clear search if focused, otherwise drop card focus
 *   j    move keyboard focus to next visible card
 *   k    move keyboard focus to previous visible card
 *   c    toggle caught on the currently focused card
 *   ?    open the shortcuts help dialog
 *
 * Shortcuts are disabled whenever the user is typing in a text input,
 * textarea, or a contenteditable surface, except for Esc which is always
 * honored and for the help dialog close action.
 */

(function keyboardModule() {
  const STORAGE_FOCUS_KEY = "pokedexKbFocusSlug";

  let currentFocusSlug = null;

  function isTypingSurface(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function currentView() {
    const raw = (location.hash || "#/liste").replace(/^#\/?/, "").split("?")[0];
    return raw || "liste";
  }

  function getGridCards() {
    const grid = document.getElementById("grid");
    if (!grid) return [];
    return [...grid.querySelectorAll(".card[data-slug]")];
  }

  function paintKbFocus() {
    const cards = getGridCards();
    for (const el of cards) el.classList.remove("is-kb-focused");
    if (!currentFocusSlug) return;
    const el = cards.find((c) => c.dataset.slug === currentFocusSlug);
    if (el) {
      el.classList.add("is-kb-focused");
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }

  function setFocusIndex(idx) {
    const cards = getGridCards();
    if (!cards.length) {
      currentFocusSlug = null;
      return;
    }
    const clamped = Math.max(0, Math.min(cards.length - 1, idx));
    currentFocusSlug = cards[clamped].dataset.slug || null;
    try {
      sessionStorage.setItem(STORAGE_FOCUS_KEY, currentFocusSlug || "");
    } catch {
      /* private mode */
    }
    paintKbFocus();
  }

  function focusIndex() {
    const cards = getGridCards();
    if (!currentFocusSlug) return -1;
    return cards.findIndex((c) => c.dataset.slug === currentFocusSlug);
  }

  function moveFocus(delta) {
    const cards = getGridCards();
    if (!cards.length) return;
    const idx = focusIndex();
    if (idx < 0) {
      setFocusIndex(delta > 0 ? 0 : cards.length - 1);
      return;
    }
    setFocusIndex(idx + delta);
  }

  function toggleCaughtOnFocus() {
    if (!currentFocusSlug) return;
    const PC = window.PokedexCollection;
    if (!PC || typeof PC.toggleCaughtBySlug !== "function") return;
    PC.toggleCaughtBySlug(currentFocusSlug);
  }

  function focusSearchInput() {
    const input = document.getElementById("search");
    if (!input) return;
    input.focus();
    try {
      input.select();
    } catch {
      /* ignore */
    }
  }

  function clearSearchInput() {
    const input = document.getElementById("search");
    if (!input) return false;
    if (input.value === "") return false;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function openHelpDialog() {
    const dlg = document.getElementById("shortcutsHelp");
    if (!dlg) return;
    if (typeof dlg.showModal === "function" && !dlg.open) {
      dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }
  }

  function closeHelpDialog() {
    const dlg = document.getElementById("shortcutsHelp");
    if (!dlg) return;
    if (typeof dlg.close === "function" && dlg.open) dlg.close();
    else dlg.removeAttribute("open");
  }

  function handleDialogWiringOnce() {
    const dlg = document.getElementById("shortcutsHelp");
    if (!dlg || dlg.dataset.wired) return;
    dlg.dataset.wired = "1";
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) closeHelpDialog();
    });
    const close = dlg.querySelector("[data-kb-close]");
    if (close) close.addEventListener("click", () => closeHelpDialog());
  }

  function onKeyDown(e) {
    handleDialogWiringOnce();
    if (e.defaultPrevented) return;
    const target = e.target;

    if (e.key === "Escape") {
      const dlg = document.getElementById("shortcutsHelp");
      if (dlg?.open) {
        closeHelpDialog();
        e.preventDefault();
        return;
      }
      if (isTypingSurface(target)) {
        if (target && target.id === "search") {
          const cleared = clearSearchInput();
          target.blur();
          if (cleared) e.preventDefault();
          return;
        }
        target.blur?.();
        return;
      }
      if (currentFocusSlug) {
        currentFocusSlug = null;
        paintKbFocus();
        e.preventDefault();
      }
      return;
    }

    if (isTypingSurface(target)) return;
    if (currentView() !== "liste") return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    switch (e.key) {
      case "/":
        e.preventDefault();
        focusSearchInput();
        return;
      case "?":
        e.preventDefault();
        openHelpDialog();
        return;
      case "j":
        e.preventDefault();
        moveFocus(1);
        return;
      case "k":
        e.preventDefault();
        moveFocus(-1);
        return;
      case "c":
        e.preventDefault();
        toggleCaughtOnFocus();
        return;
      default:
        return;
    }
  }

  window.PokevaultKeyboard = {
    getFocusSlug: () => currentFocusSlug,
    setFocusSlug(slug) {
      currentFocusSlug = slug || null;
      paintKbFocus();
    },
    repaint: paintKbFocus,
    openHelp: openHelpDialog,
    closeHelp: closeHelpDialog,
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("DOMContentLoaded", () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_FOCUS_KEY);
      if (saved) currentFocusSlug = saved;
    } catch {
      /* ignore */
    }
    handleDialogWiringOnce();
  });
})();
