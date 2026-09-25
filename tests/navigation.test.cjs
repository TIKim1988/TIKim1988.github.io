const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runInNewContext } = require('node:vm');
const { readFileSync } = require('node:fs');
const source = readFileSync(require('node:path').join(__dirname, '../navigation.js'), 'utf8');

function load({ saved = null, current = null, denied = false } = {}) {
  const queue = new Set(), events = {};
  let value = saved, writes = 0;
  const storage = {
    getItem() { if (denied) throw Error('blocked'); return value; },
    setItem(key, data) { if (denied) throw Error('blocked'); value = data; writes++; },
  };
  const groups = ['testcases','engine'].map(id => {
    let open = id === 'testcases' || current === id;
    return {
      dataset: { navGroup:id, defaultOpen:String(id === 'testcases') },
      get open() { return open; },
      set open(v) { if (open !== v) { open = v; queue.add(this); } },
      querySelector: () => current === id ? {} : null,
      addEventListener(name, callback) { this[name] = callback; },
    };
  });
  const document = { querySelectorAll: () => groups };
  const window = { localStorage: storage, addEventListener(name, callback) { events[name] = callback; } };
  runInNewContext(source, {document,window});
  function flush() { for (const group of queue) group.toggle(); queue.clear(); }
  flush();
  return {
    state: () => groups.map(g=>g.open),
    saved: () => value,
    writes: () => writes,
    toggle(id) { const group=groups.find(g=>g.dataset.navGroup===id);group.open=!group.open;flush(); },
    returnFromCache(data) { value=data;events.pageshow({persisted:true});flush(); },
  };
}

test('new home visit preserves the TC-open default without writing preferences', () => {
  const app=load(); assert.deepEqual(app.state(),[true,false]); assert.equal(app.writes(),0);
});

test('active article opens its folder while preserving the other saved state', () => {
  const saved=JSON.stringify({testcases:false,engine:false});
  const app=load({saved,current:'engine'});
  assert.deepEqual(app.state(),[false,true]); assert.equal(app.saved(),saved); assert.equal(app.writes(),0);
});

test('manual changes survive navigation independently', () => {
  const app=load(); app.toggle('testcases'); app.toggle('engine');
  const next=load({saved:app.saved()});
  assert.deepEqual(next.state(),[false,true]);
});

test('current folder can be closed manually, but opens again on article entry', () => {
  const app=load({current:'engine'}); app.toggle('engine');
  assert.deepEqual(app.state(),[true,false]);
  const next=load({saved:app.saved(),current:'engine'});
  assert.deepEqual(next.state(),[true,true]);
  assert.equal(JSON.parse(next.saved()).engine,false);
  assert.equal(next.writes(),0);
});

test('automatic opening does not override the saved choice when returning home', () => {
  const article=load({saved:JSON.stringify({testcases:false,engine:false}),current:'engine'});
  const home=load({saved:article.saved()});
  assert.deepEqual(home.state(),[false,false]);
});

test('back-forward cache restores latest choices and reveals the active folder', () => {
  const app=load({current:'engine'}); app.toggle('engine');
  app.returnFromCache(JSON.stringify({testcases:false,engine:false}));
  assert.deepEqual(app.state(),[false,true]);
  assert.equal(app.writes(),1);
});

test('malformed or non-boolean saved values use defaults', () => {
  for(const saved of ['not-json','null','[]','{"testcases":"false","engine":1}']) {
    assert.deepEqual(load({saved}).state(),[true,false]);
  }
});

test('storage restrictions do not prevent toggling or revealing the current article', () => {
  const app=load({denied:true,current:'engine'});
  assert.deepEqual(app.state(),[true,true]);
  app.toggle('testcases'); app.toggle('engine');
  assert.deepEqual(app.state(),[false,false]);
});
