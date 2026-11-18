const $ = s => document.querySelector(s);

let settings;
let tab;
let values = {};    // kentän avain → arvo
let found = {};     // kentän avain → { method, score } tunnistuksesta
let manual = {};    // kentän avain → true, jos käyttäjä muokannut/poiminut
let source = '';

// ---------------------------------------------------------------------------
// Käynnistys

init().catch(err => setStatus('Virhe: ' + err.message, 'warn'));

async function init() {
  settings = await tarraLoadSettings();
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  buildFields();
  buildControls();
  bindActions();
  renderHistory();

  await extract();

  // Palautetaan käyttäjän omat muutokset ja sivulta poimitut arvot samalle sivulle.
  const { draft } = await chrome.storage.local.get('draft');
  if (draft && tab && draft.url === tab.url) {
    for (const k of Object.keys(draft.manual || {})) {
      values[k] = draft.values[k] || '';
      manual[k] = true;
    }
  }
  updateFieldInputs();
  render();
}

// ---------------------------------------------------------------------------
// Tunnistus

function canScript(url) {
  return /^(https?|file):/i.test(url || '') && !/^https:\/\/chrome\.google\.com\/webstore/i.test(url);
}

async function extract() {
  values = {};
  found = {};
  manual = {};
  source = '';

  if (!tab || !canScript(tab.url)) {
    setStatus('Tätä sivua ei voi lukea – syötä tiedot käsin', 'warn');
    return;
  }

  const cfg = {
    fields: TARRA_FIELDS.map(f => ({ key: f.key, type: f.type, synonyms: settings.fields[f.key].synonyms }))
  };

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: tarraExtract,
      args: [cfg]
    });
  } catch (e) {
    setStatus('Sivun lukeminen epäonnistui: ' + e.message, 'warn');
    return;
  }

  // Yhdistetään kehysten (iframe) tulokset: paras pistemäärä voittaa kentittäin.
  const frames = results.map(r => r.result).filter(Boolean);
  for (const fr of frames) {
    if (fr.source && !source) source = fr.source;
    for (const [k, f] of Object.entries(fr.fields || {})) {
      if (!found[k] || f.score > found[k].score) found[k] = f;
    }
  }
  for (const [k, f] of Object.entries(found)) values[k] = f.value;

  const n = Object.keys(found).length;
  if (!n) {
    setStatus('Tietoja ei tunnistettu – syötä tai poimi sivulta ⌖', 'warn');
  } else {
    // Kaikkia kenttiä ei ole joka järjestelmässä (esim. IMEI vain puhelimissa).
    setStatus(`${source || 'Yleinen tunnistus'} · ${n} kenttää tunnistettu`, n >= 3 ? 'ok' : '');
  }
}

function setStatus(text, cls = '') {
  const el = $('#status');
  el.textContent = text;
  el.title = text;
  el.className = 'chip ' + cls;
}

// ---------------------------------------------------------------------------
// Kentät

function buildFields() {
  const box = $('#fields');
  box.textContent = '';
  for (const f of TARRA_FIELDS) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.key = f.key;
    wrap.innerHTML = `
      <div class="field-head">
        <label title="Näytä tarralla"><input type="checkbox" class="show"><span class="name"></span></label>
        <span class="src"></span>
      </div>
      <div class="field-input">
        <input type="text" class="val" spellcheck="false">
        <button class="pick" title="Poimi arvo klikkaamalla sivulta">⌖</button>
      </div>`;
    wrap.querySelector('.name').textContent = f.name;
    const show = wrap.querySelector('.show');
    show.checked = !!settings.fields[f.key].show;
    show.addEventListener('change', () => {
      settings.fields[f.key].show = show.checked;
      tarraSaveSettings(settings);
      updateFieldInputs();
      render();
    });
    const input = wrap.querySelector('.val');
    input.placeholder = f.type === 'date' ? 'pp.kk.vvvv' : '';
    input.addEventListener('input', () => {
      values[f.key] = input.value;
      manual[f.key] = true;
      saveDraft();
      updateFieldBadge(f.key);
      render();
    });
    wrap.querySelector('.pick').addEventListener('click', () => startPick(f));
    box.appendChild(wrap);
  }
}

function updateFieldInputs() {
  for (const f of TARRA_FIELDS) {
    const wrap = document.querySelector(`.field[data-key="${f.key}"]`);
    const input = wrap.querySelector('.val');
    if (document.activeElement !== input) input.value = values[f.key] || '';
    wrap.classList.toggle('hidden-on-label', !settings.fields[f.key].show);
    updateFieldBadge(f.key);
  }
}

function updateFieldBadge(key) {
  const src = document.querySelector(`.field[data-key="${key}"] .src`);
  if (manual[key]) {
    src.textContent = 'muokattu';
    src.className = 'src manual';
    src.title = 'Arvo on syötetty tai poimittu käsin';
  } else if (found[key]) {
    src.textContent = '✓ ' + found[key].method;
    src.className = 'src found';
    src.title = 'Tunnistettu sivulta';
  } else {
    src.textContent = 'ei löytynyt';
    src.className = 'src missing';
    src.title = '';
  }
}

function saveDraft() {
  if (!tab) return;
  return chrome.storage.local.set({ draft: { url: tab.url, values, manual, t: Date.now() } });
}

// ---------------------------------------------------------------------------
// Poiminta sivulta

async function startPick(field) {
  if (!tab || !canScript(tab.url)) { toast('Tältä sivulta ei voi poimia'); return; }
  await saveDraft();
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (field, name, url) => { window.__tarraPick = { field, name, url }; },
      args: [field.key, field.name, tab.url]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['picker.js']
    });
    window.close();
  } catch (e) {
    toast('Poiminta epäonnistui: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// Tarran asetukset ja esikatselu

function buildControls() {
  const size = $('#size');
  for (const [k, v] of Object.entries(TARRA_SIZES)) size.add(new Option(v.name, k));
  size.value = settings.size;

  const bc = $('#barcode');
  bc.add(new Option('Ei viivakoodia', 'none'));
  for (const f of TARRA_FIELDS) if (f.type !== 'date' && f.type !== 'pin') bc.add(new Option(f.name, f.key));
  bc.value = settings.barcode;

  $('#customW').value = settings.customW;
  $('#customH').value = settings.customH;
  $('#customSize').hidden = settings.size !== 'custom';
  $('#copies').value = settings.copies || 1;

  const onChange = () => {
    settings.size = size.value;
    settings.barcode = bc.value;
    settings.customW = +$('#customW').value || 89;
    settings.customH = +$('#customH').value || 36;
    settings.copies = Math.min(50, Math.max(1, +$('#copies').value || 1));
    $('#customSize').hidden = settings.size !== 'custom';
    tarraSaveSettings(settings);
    render();
  };
  for (const id of ['#size', '#barcode', '#customW', '#customH', '#copies']) $(id).addEventListener('change', onChange);
}

function render() {
  const host = $('#preview');
  const wrap = $('#previewWrap');
  host.style.transform = '';
  const { warnings } = renderLabel(host, values, settings);

  // Skaalataan esikatselu mahtumaan popupiin.
  const label = host.firstElementChild;
  const avail = wrap.clientWidth - 20;
  const scale = Math.min(1.4, avail / label.offsetWidth);
  host.style.transform = `scale(${scale})`;
  host.style.marginLeft = Math.max(0, (avail - label.offsetWidth * scale) / 2) + 'px';
  wrap.style.height = Math.ceil(label.offsetHeight * scale + 20) + 'px';

  const ul = $('#warnings');
  ul.textContent = '';
  for (const w of warnings) {
    const li = document.createElement('li');
    li.textContent = w;
    ul.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Toiminnot

function bindActions() {
  $('#print').addEventListener('click', printLabel);
  $('#copy').addEventListener('click', copyText);
  $('#clear').addEventListener('click', async () => {
    values = {};
    manual = {};
    found = {};
    await chrome.storage.local.remove('draft');
    updateFieldInputs();
    render();
  });
  $('#refresh').addEventListener('click', async () => {
    await chrome.storage.local.remove('draft');
    setStatus('Haetaan…');
    await extract();
    updateFieldInputs();
    render();
  });
  $('#openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); printLabel(); }
  });
}

async function printLabel() {
  const job = { values: { ...values }, settings, copies: settings.copies || 1, t: Date.now() };
  await chrome.storage.local.set({ printJob: job });
  await addHistory(job.values);
  await chrome.tabs.create({ url: chrome.runtime.getURL('print.html'), active: true });
}

async function copyText() {
  const lines = TARRA_FIELDS
    .filter(f => values[f.key])
    .map(f => `${f.name}: ${values[f.key]}`);
  if (!lines.length) { toast('Ei kopioitavaa'); return; }
  await navigator.clipboard.writeText(lines.join('\n'));
  toast('Kopioitu leikepöydälle');
}

// ---------------------------------------------------------------------------
// Historia

async function addHistory(v) {
  const { history = [] } = await chrome.storage.local.get('history');
  const id = x => [x.idNum, x.sn, x.nimi].join('|');
  const list = [{ values: v, t: Date.now() }, ...history.filter(h => id(h.values) !== id(v))].slice(0, 20);
  await chrome.storage.local.set({ history: list });
}

async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  const ul = $('#history');
  ul.textContent = '';
  $('#historyBox').hidden = !history.length;
  for (const h of history) {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.className = 'h-text';
    text.textContent = [h.values.idNum, h.values.nimi, h.values.sn].filter(Boolean).join(' · ') || '(tyhjä)';
    const time = document.createElement('span');
    time.className = 'h-time';
    const d = new Date(h.t);
    time.textContent = `${d.getDate()}.${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    li.append(text, time);
    li.title = 'Lataa nämä tiedot';
    li.addEventListener('click', () => {
      values = { ...h.values };
      manual = {};
      for (const k of Object.keys(values)) manual[k] = true;
      saveDraft();
      updateFieldInputs();
      render();
      toast('Tiedot ladattu historiasta');
    });
    ul.appendChild(li);
  }
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}
