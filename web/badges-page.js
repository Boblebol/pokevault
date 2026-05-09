(function initBadgesPage() {
  "use strict";

  let started = false;
  let localeSubscribed = false;

  function render() {
    const host = document.getElementById("badgesBody");
    const badges = window.PokevaultBadges;
    if (!host || !badges?.renderInto) return;
    badges.renderInto(host);
  }

  function start() {
    if (started) {
      render();
      return;
    }
    started = true;
    if (!localeSubscribed) {
      window.PokedexI18n?.subscribe?.(() => render());
      window.PokevaultI18n?.subscribeLocale?.(() => render());
      localeSubscribed = true;
    }
    window.PokevaultBadges?.subscribe?.(() => render());
    void window.PokevaultBadges?.poll?.({ silent: true }).then(() => render());
    render();
  }

  window.PokevaultBadgesPage = { render, start };
})();
