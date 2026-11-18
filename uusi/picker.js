// Poimintatila: käyttäjä klikkaa sivulta elementtiä, jonka teksti tallennetaan kenttään.
// Injektoidaan kaikkiin kehyksiin; window.__tarraPick asetetaan ennen tätä tiedostoa.
(() => {
  const cfg = window.__tarraPick;
  if (!cfg) return;
  if (window.__tarraPickCleanup) window.__tarraPickCleanup();

  const isTop = window === window.top;
  const Z = 2147483647;

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: Z, border: '2px solid #0b5cad',
    background: 'rgba(11,92,173,.12)', borderRadius: '3px', transition: 'all .05s', display: 'none'
  });
  document.documentElement.appendChild(box);

  let banner = null;
  if (isTop) {
    banner = document.createElement('div');
    Object.assign(banner.style, {
      position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: Z,
      background: '#1d2330', color: '#fff', padding: '8px 14px', borderRadius: '8px',
      font: '600 13px "Segoe UI", Arial, sans-serif', boxShadow: '0 3px 12px rgba(0,0,0,.3)',
      pointerEvents: 'none'
    });
    banner.textContent = `Tarra365: klikkaa kenttää "${cfg.name}" (voit myös maalata tekstin) · Esc peruuttaa`;
    document.documentElement.appendChild(banner);
  }

  function onMove(e) {
    const el = e.target;
    if (!el || el === box) return;
    const r = el.getBoundingClientRect();
    Object.assign(box.style, {
      display: 'block', left: r.left - 2 + 'px', top: r.top - 2 + 'px',
      width: r.width + 4 + 'px', height: r.height + 4 + 'px'
    });
  }

  function textOf(el) {
    if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) return el.value;
    if (el.tagName === 'SELECT') return el.selectedOptions[0]?.text || el.value;
    return el.innerText || el.textContent || '';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const sel = String(window.getSelection() || '').replace(/\s+/g, ' ').trim();
    let text = sel || textOf(e.target).split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
    text = text.replace(/ /g, ' ').trim().slice(0, 200);
    save(text);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      chrome.storage.local.set({ pickDone: { t: Date.now(), cancelled: true } });
    }
  }

  async function save(text) {
    const { draft } = await chrome.storage.local.get('draft');
    const d = draft && draft.url === cfg.url ? draft : { url: cfg.url, values: {}, manual: {} };
    d.values[cfg.field] = text;
    d.manual[cfg.field] = true;
    d.t = Date.now();
    await chrome.storage.local.set({ draft: d, pickDone: { t: Date.now(), name: cfg.name, text } });
    chrome.runtime.sendMessage({ type: 'tarraPickDone' }).catch(() => {});
  }

  function onStorage(changes, area) {
    if (area !== 'local' || !changes.pickDone) return;
    const res = changes.pickDone.newValue || {};
    cleanup();
    if (isTop && !res.cancelled) showToast(`✓ ${res.name}: ${res.text || '(tyhjä)'}`);
  }

  function showToast(msg) {
    const t = document.createElement('div');
    Object.assign(t.style, {
      position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: Z,
      background: '#1d7a3a', color: '#fff', padding: '8px 14px', borderRadius: '8px',
      font: '600 13px "Segoe UI", Arial, sans-serif', boxShadow: '0 3px 12px rgba(0,0,0,.3)',
      maxWidth: '80vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
    });
    t.textContent = msg + ' — avaa Tarra365 jatkaaksesi';
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    chrome.storage.onChanged.removeListener(onStorage);
    box.remove();
    banner?.remove();
    delete window.__tarraPick;
    delete window.__tarraPickCleanup;
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  chrome.storage.onChanged.addListener(onStorage);
  window.__tarraPickCleanup = cleanup;
})();
