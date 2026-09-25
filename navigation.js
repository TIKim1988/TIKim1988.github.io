(() => {
  'use strict';

  const key = 'taeik-blog-nav-v1';
  const groups = [...document.querySelectorAll('.lnb details[data-nav-group]')];
  let remembered = {};
  const displayed = new Map();

  function readPreferences() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(key));
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
      return Object.fromEntries(groups
        .map(group => group.dataset.navGroup)
        .filter(id => typeof saved[id] === 'boolean')
        .map(id => [id, saved[id]]));
    } catch {
      return remembered;
    }
  }

  function restore() {
    remembered = readPreferences();
    groups.forEach(group => {
      const id = group.dataset.navGroup;
      const current = Boolean(group.querySelector('a[aria-current="page"]'));
      group.open = current || (remembered[id] ?? group.dataset.defaultOpen === 'true');
      // Native toggle events are queued. Do not save automatic restoration as a user choice.
      displayed.set(group, group.open);
    });
  }

  restore();
  groups.forEach(group => {
    group.addEventListener('toggle', () => {
      if (displayed.get(group) === group.open) return;
      displayed.set(group, group.open);
      remembered = { ...readPreferences(), [group.dataset.navGroup]: group.open };
      try {
        window.localStorage.setItem(key, JSON.stringify(remembered));
      } catch {
        // Native details controls still work if browser storage is unavailable.
      }
    });
  });

  window.addEventListener('pageshow', event => {
    if (event.persisted) restore();
  });
})();
