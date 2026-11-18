// Tarran piirto: käytetään sekä popupin esikatselussa että tulostussivulla,
// joten esikatselu vastaa aina tulostetta.

// Code 128 -kuviot (palkki/väli-leveydet), arvot 0–106.
const CODE128 = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
  '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112'
).split(' ');

function code128Codes(text) {
  const codes = [];
  if (/^\d+$/.test(text) && text.length >= 4 && text.length % 2 === 0) {
    codes.push(105); // Start C – numeropareja, tiivein koodi
    for (let i = 0; i < text.length; i += 2) codes.push(parseInt(text.substr(i, 2), 10));
  } else {
    codes.push(104); // Start B
    for (const ch of text) {
      let c = ch.charCodeAt(0);
      if (c < 32 || c > 126) c = 63; // '?'
      codes.push(c - 32);
    }
  }
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103, 106);
  return codes;
}

// Palauttaa { svg, modules } – svg venytetään haluttuun leveyteen.
function code128Svg(text) {
  const QUIET = 10;
  let x = QUIET;
  let rects = '';
  for (const code of code128Codes(text)) {
    const p = CODE128[code];
    for (let j = 0; j < p.length; j++) {
      const w = +p[j];
      if (j % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="1"/>`;
      x += w;
    }
  }
  const modules = x + QUIET;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} 1" ` +
              `preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
  return { svg, modules };
}

function tarraEnsureStyle(doc) {
  if (doc.getElementById('tarra-style')) return;
  const st = doc.createElement('style');
  st.id = 'tarra-style';
  st.textContent = `
    .tarra { box-sizing: border-box; background: #fff; color: #000; overflow: hidden;
             font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; line-height: 1.15;
             display: flex; flex-direction: column; }
    .tarra * { box-sizing: border-box; }
    .tarra-body { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 0.15em; }
    .tarra-line { white-space: nowrap; overflow: hidden; text-overflow: clip; flex: none; }
    .tarra-title { font-weight: 700; }
    .tarra-row { display: flex; gap: 1.2mm; align-items: baseline; flex: none; min-width: 0; }
    .tarra-k { flex: none; }
    .tarra-v { font-weight: 700; flex: 1 1 auto; min-width: 0; }
    .tarra-extra { font-size: 0.85em; }
    .tarra-bc { flex: none; margin-top: auto; padding-top: 0.6mm; display: flex; justify-content: center; }
    .tarra-bc svg { display: block; fill: #000; }
  `;
  doc.head.appendChild(st);
}

// Piirtää tarran host-elementin sisään. Palauttaa { warnings: [] }.
function renderLabel(host, values, s) {
  const doc = host.ownerDocument;
  tarraEnsureStyle(doc);
  const size = tarraSize(s);
  const pad = Math.max(0, +s.padding || 0);
  const warnings = [];

  host.textContent = '';
  const el = doc.createElement('div');
  el.className = 'tarra';
  el.style.width = size.w + 'mm';
  el.style.height = size.h + 'mm';
  el.style.padding = pad + 'mm';

  const body = doc.createElement('div');
  body.className = 'tarra-body';
  el.appendChild(body);

  const fitEls = []; // { el, scale }
  const val = k => String(values[k] || '').trim();
  const shown = k => s.fields[k] && s.fields[k].show && val(k);

  if (s.titleField && shown(s.titleField)) {
    const t = doc.createElement('div');
    t.className = 'tarra-line tarra-title';
    t.textContent = val(s.titleField);
    body.appendChild(t);
    fitEls.push({ el: t, scale: 1.25 });
  }

  for (const f of TARRA_FIELDS) {
    if (f.key === s.titleField || !shown(f.key)) continue;
    const row = doc.createElement('div');
    row.className = 'tarra-row';
    const tag = (s.fields[f.key].tag || '').trim();
    if (tag) {
      const k = doc.createElement('span');
      k.className = 'tarra-k';
      k.textContent = tag;
      row.appendChild(k);
    }
    const v = doc.createElement('span');
    v.className = 'tarra-line tarra-v';
    v.textContent = val(f.key);
    row.appendChild(v);
    body.appendChild(row);
    fitEls.push({ el: row, scale: 1, check: v });
  }

  if ((s.extraText || '').trim()) {
    const x = doc.createElement('div');
    x.className = 'tarra-line tarra-extra';
    x.textContent = s.extraText.trim();
    body.appendChild(x);
    fitEls.push({ el: x, scale: 0.85 });
  }

  const bcValue = s.barcode && s.barcode !== 'none' ? val(s.barcode) : '';
  if (bcValue) {
    const { svg, modules } = code128Svg(bcValue);
    const innerW = size.w - 2 * pad;
    const moduleMm = Math.min(0.5, innerW / modules);
    if (moduleMm < 0.19) warnings.push('Viivakoodi on liian tiheä luettavaksi – käytä leveämpää tarraa tai lyhyempää arvoa.');
    const bc = doc.createElement('div');
    bc.className = 'tarra-bc';
    bc.innerHTML = svg; // sisältää vain numeroita, ei käyttäjän tekstiä
    const svgEl = bc.firstChild;
    svgEl.style.width = (modules * moduleMm).toFixed(2) + 'mm';
    svgEl.style.height = (+s.barcodeHeight || 7) + 'mm';
    body.appendChild(bc);
  }

  if (!body.childElementCount) {
    const e = doc.createElement('div');
    e.className = 'tarra-line';
    e.style.color = '#999';
    e.textContent = 'Tyhjä tarra';
    body.appendChild(e);
  }

  host.appendChild(el);

  // 1) Pienennetään koko tarran fonttia kunnes rivit mahtuvat korkeussuunnassa.
  const MIN = 4.5;
  let fs = Math.max(MIN, +s.fontSize || 10);
  const apply = () => fitEls.forEach(f => { f.el.style.fontSize = (fs * f.scale).toFixed(2) + 'pt'; });
  apply();
  while (fs > MIN && body.scrollHeight > body.clientHeight + 0.5) { fs -= 0.25; apply(); }
  if (body.scrollHeight > body.clientHeight + 0.5) warnings.push('Kaikki rivit eivät mahdu tarralle.');

  // 2) Pienennetään yksittäisiä liian leveitä rivejä.
  for (const f of fitEls) {
    const c = f.check || f.el;
    let size2 = fs * f.scale;
    while (size2 > MIN && c.scrollWidth > c.clientWidth + 0.5) {
      size2 -= 0.25;
      f.el.style.fontSize = size2.toFixed(2) + 'pt';
    }
    if (c.scrollWidth > c.clientWidth + 0.5) warnings.push(`Teksti "${c.textContent.slice(0, 24)}…" katkeaa.`);
  }

  return { warnings, size };
}
