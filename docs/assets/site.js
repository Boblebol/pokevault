(function initPokevaultPages() {
  "use strict";

  function markActiveNav() {
    var path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav]").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var target = href.split("/").pop() || "index.html";
      if (target === path) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function wireCopyButtons() {
    document.querySelectorAll("[data-copy]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = document.querySelector(button.getAttribute("data-copy") || "");
        var text = target ? target.textContent.trim() : "";
        if (!text || !navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(function () {
          var old = button.textContent;
          button.textContent = "Copied";
          window.setTimeout(function () {
            button.textContent = old;
          }, 1400);
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      markActiveNav();
      wireCopyButtons();
    }, { once: true });
  } else {
    markActiveNav();
    wireCopyButtons();
  }
})();
