// Home page: lock sections that are not open yet, show crowns, reset progress.
(function (UT) {
  'use strict';
  const { $, progress, ORDER, TITLES, CROWN_SVG, LOCK_SVG } = UT.ui;

  progress.checkUnlockParam();

  function render() {
    const p = progress.load();
    for (const key of ORDER) {
      const card = document.querySelector(`.card[data-key="${key}"]`);
      if (!card) continue;
      if (!card.dataset.href) card.dataset.href = card.getAttribute('href');
      card.querySelectorAll('.badge').forEach(b => b.remove());
      const go = card.querySelector('.go');
      const unlocked = progress.isUnlocked(key, p);
      card.classList.toggle('locked', !unlocked);
      if (unlocked) {
        card.setAttribute('href', card.dataset.href);
        card.removeAttribute('aria-disabled');
        go.textContent = key === 'explore' ? 'Open →' : 'Start →';
      } else {
        card.removeAttribute('href');
        card.setAttribute('aria-disabled', 'true');
        const why = key === 'advanced'
          ? `Earn all three practice crowns to unlock (${progress.crownCount(p)} of 3)`
          : `Open ${TITLES[ORDER[ORDER.indexOf(key) - 1]]} first`;
        go.innerHTML = `${LOCK_SVG}<span>${why}</span>`;
      }
      if (p.crowns[key]) {
        card.insertAdjacentHTML('afterbegin', `<span class="badge" title="Crown earned">${CROWN_SVG}<span class="vis">Crown earned</span></span>`);
      }
    }
  }

  $('resetProgress').addEventListener('click', () => {
    if (window.confirm('Reset your progress? This locks the sections again and removes your crowns on this device.')) {
      progress.reset();
      render();
    }
  });

  render();
})(globalThis.UT);
