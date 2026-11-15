// Save file support for the Windows launcher (Zentra.exe).
// The game keeps its progress in localStorage (keys starting with "zentra").
// When it runs from Zentra.exe, those keys are also mirrored to Zentra-save.json next to the exe:
// read once at startup (before any other script reads localStorage), written after every change.
// Anywhere else (the website, npx serve) this does nothing and localStorage alone is used.
// Classic script, not a module: it must finish before the game modules run.
(function () {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  var URL = '/__save';
  var PREFIX = 'zentra';
  var hasFile = false;

  // 1. restore: the save file wins over whatever this browser has for this address
  try {
    var x = new XMLHttpRequest();
    x.open('GET', URL, false);
    x.send();
    if (x.status !== 200 || x.getResponseHeader('X-Zentra-Save') !== '1') return; // not the exe: stop here
    hasFile = !!x.responseText;          // no file yet: keep this browser's save and copy it into a new file
    var data = hasFile ? JSON.parse(x.responseText) : {};
    for (var i = localStorage.length - 1; hasFile && i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0 && !(k in data)) localStorage.removeItem(k);
    }
    for (var key in data) if (key.indexOf(PREFIX) === 0) localStorage.setItem(key, String(data[key]));
  } catch (e) { return; }

  // 2. mirror every later change to the file (debounced; flushed when the tab closes)
  var snapshot = function () {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) out[k] = localStorage.getItem(k);
    }
    return JSON.stringify(out);
  };
  var timer = null;
  var write = function () {
    timer = null;
    try { fetch(URL, { method: 'POST', body: snapshot(), keepalive: true }); } catch (e) {}
  };
  var schedule = function () { if (!timer) timer = setTimeout(write, 300); };
  var set = Storage.prototype.setItem, del = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k) { set.apply(this, arguments); if (String(k).indexOf(PREFIX) === 0) schedule(); };
  Storage.prototype.removeItem = function (k) { del.apply(this, arguments); if (String(k).indexOf(PREFIX) === 0) schedule(); };
  if (!hasFile) schedule();
  addEventListener('pagehide', function () {
    if (timer) { clearTimeout(timer); timer = null; }
    try { navigator.sendBeacon(URL, snapshot()); } catch (e) {}
  });
})();
