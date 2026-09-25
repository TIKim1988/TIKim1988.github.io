const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../theme.js'), 'utf8');

function load({ dark = false, saved = null, denied = false, writeDenied = false } = {}) {
  const events = {}, root = { dataset: {} }, status = {}, control = { hidden: true };
  const values = new Map(saved ? [['taeik-blog-theme', saved]] : []);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (writeDenied) throw Error('blocked'); values.set(key, value); },
    removeItem(key) { if (writeDenied) throw Error('blocked'); values.delete(key); },
  };
  const buttons = ['system', 'light', 'dark'].map(choice => ({
    dataset: { themeChoice: choice }, attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(name, fn) { this[name] = fn; },
  }));
  let ready = false;
  const media = { matches: dark, addEventListener(name, fn) { events.media = fn; } };
  const document = {
    documentElement: root,
    querySelectorAll: selector => !ready ? [] : selector === '[data-theme-choice]' ? buttons : [control],
    getElementById: () => ready ? status : null,
    addEventListener(name, fn) { events[name] = fn; },
  };
  const window = {
    matchMedia: () => media,
    get localStorage() { if (denied) throw Error('disabled'); return storage; },
    addEventListener(name, fn) { events[name] = fn; },
  };
  runInNewContext(source, { window, document });
  return {
    root, values, control, status, buttons,
    ready() { ready = true; events.DOMContentLoaded(); },
    click(choice) { buttons.find(b => b.dataset.themeChoice === choice).click(); },
    systemChange(dark) { media.matches = dark; events.media(); },
    otherTab(value, key = 'taeik-blog-theme', storageArea = storage) { events.storage({key, newValue:value, storageArea}); },
  };
}

for (const dark of [false, true]) test(`first visit follows ${dark ? 'dark' : 'light'} system before content loads`, () => {
  const app = load({ dark });
  assert.equal(app.root.dataset.theme, dark ? 'dark' : 'light');
  assert.equal(app.root.dataset.themePreference, 'system');
  app.ready();
  assert.equal(app.control.hidden, false);
  assert.equal(app.buttons[0].attrs['aria-pressed'], 'true');
});

test('system changes live, manual selection overrides it, and system button restores it', () => {
  const app = load(); app.ready(); app.systemChange(true);
  assert.equal(app.root.dataset.theme, 'dark');
  app.click('light'); app.systemChange(false); app.systemChange(true);
  assert.equal(app.root.dataset.theme, 'light');
  app.click('system');
  assert.equal(app.root.dataset.theme, 'dark');
  assert.equal(app.values.has('taeik-blog-theme'), false);
  assert.match(app.status.textContent, /시스템 설정/);
});

test('manual preference survives a fresh page and is applied before content', () => {
  const app = load(); app.ready(); app.click('dark');
  const fresh = load({ saved: app.values.get('taeik-blog-theme'), dark: false });
  assert.equal(fresh.root.dataset.theme, 'dark');
  fresh.ready();
  assert.deepEqual(fresh.buttons.map(b=>b.attrs['aria-pressed']), ['false','false','true']);
});

test('invalid saved values fall back to system', () => {
  const app = load({ saved: 'invalid', dark: true });
  assert.equal(app.root.dataset.theme, 'dark');
  assert.equal(app.root.dataset.themePreference, 'system');
});

for (const options of [{ denied: true }, { writeDenied: true }]) test(`storage restriction does not break manual selection: ${JSON.stringify(options)}`, () => {
  const app = load(options); app.ready(); app.click('dark');
  assert.equal(app.root.dataset.theme, 'dark');
  app.click('system');
  assert.equal(app.root.dataset.theme, 'light');
});

test('another tab synchronizes preferences; unrelated storage events are ignored', () => {
  const app = load({dark:true}); app.ready(); app.otherTab('light');
  assert.equal(app.root.dataset.theme, 'light');
  app.otherTab('dark', 'unrelated'); app.otherTab('dark', 'taeik-blog-theme', {});
  assert.equal(app.root.dataset.theme, 'light');
  app.otherTab(null);
  assert.equal(app.root.dataset.themePreference, 'system');
  assert.equal(app.root.dataset.theme, 'dark');
  app.otherTab('light'); app.otherTab(null, null);
  assert.equal(app.root.dataset.themePreference, 'system');
});
