(() => {
  'use strict';

  const key = 'taeik-blog-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const normalize = value => value === 'light' || value === 'dark' ? value : 'system';
  let storage;
  let preference = 'system';
  try {
    storage = window.localStorage;
    preference = normalize(storage.getItem(key));
  } catch {
    // Storage may be disabled. The current page still supports manual selection.
  }

  function apply() {
    const resolved = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
    });
    const status = document.getElementById('theme-status');
    if (status) {
      const label = resolved === 'dark' ? '블랙' : '기본';
      status.textContent = preference === 'system' ? `시스템 설정에 따라 ${label} 테마 적용` : `${label} 테마 적용`;
    }
  }

  // Run in the head so the saved preference is applied before the first paint.
  apply();
  if (system.addEventListener) system.addEventListener('change', apply);
  else system.addListener(apply);

  window.addEventListener('storage', event => {
    if (!storage || event.storageArea !== storage || (event.key !== key && event.key !== null)) return;
    preference = normalize(event.newValue);
    apply();
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => {
        preference = normalize(button.dataset.themeChoice);
        try {
          if (preference === 'system') storage?.removeItem(key);
          else storage?.setItem(key, preference);
        } catch {
          // Keep the selection for this page even if persistence is unavailable.
        }
        apply();
      });
    });
    apply();
    document.querySelectorAll('.theme-controls').forEach(control => { control.hidden = false; });
  }, { once: true });
})();
