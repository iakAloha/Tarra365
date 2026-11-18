// Sivulle injektoitava tunnistusfunktio. Funktion täytyy olla itsenäinen
// (chrome.scripting serialisoi sen), joten se ei saa viitata ulkoisiin muuttujiin.
//
// cfg = { fields: [{ key, type, synonyms: [] }] }
// Palauttaa { source, url, fields: { key: { value, score, method } } }
//
// Pisteytys (suurempi voittaa):
//   100  järjestelmäkohtainen profiili (3stepIT, Tesma)
//    85  <label for> → kenttä
//    80  otsikkosolu/-elementti (th, td, dt, label) + viereinen arvo
//    70  muu elementti + viereinen arvo
//    40  vapaa teksti muodossa "Otsikko: arvo"
function tarraExtract(cfg) {
  const clean = s => String(s || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  // Väliviiva ja välilyönti tulkitaan samaksi: "SIM-kortin numero" = "SIM kortin numero".
  const norm = s => clean(s).replace(/(\p{L})[-‐‑–](?=\p{L})/gu, '$1 ').replace(/\s+/g, ' ')
    .trim().toLowerCase().replace(/[\s:：*]+$/, '');
  const firstLine = s => clean(s).split(/\r?\n/).map(x => x.trim()).find(Boolean) || '';

  function parseDate(s) {
    let m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/);
    let d, mo, y;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    else {
      m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (!m) return null;
      y = +m[1]; mo = +m[2]; d = +m[3];
    }
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    return `${d}.${mo}.${y}`;
  }

  const fieldByKey = {};
  const synMap = new Map();          // normalisoitu otsikko → kentän avain
  const synRank = new Map();         // otsikon järjestys listalla (tasapisteissä aiempi voittaa)
  for (const f of cfg.fields) {
    fieldByKey[f.key] = f;
    (f.synonyms || []).forEach((s, i) => {
      const n = norm(s);
      if (n && !synMap.has(n)) { synMap.set(n, f.key); synRank.set(n, i); }
    });
  }

  const best = {};
  function offer(key, raw, score, method, label) {
    const f = fieldByKey[key];
    if (!f) return;
    if (label) score -= (synRank.get(label) || 0) * 0.01;
    let v = firstLine(raw).replace(/^[\s:：\-–|]+/, '').replace(/[\s\-–|,;]+$/, '');
    if (!v || v.length > 150) return;
    if (synMap.has(norm(v))) return;                 // arvo on itse toinen otsikko
    if (/^(-|–|n\/a|ei tiedossa|null|undefined)$/i.test(v)) return;
    if (f.type === 'date') { v = parseDate(v); if (!v) return; }
    if (f.type === 'imei') {
      // IMEI = 15 numeroa (14–16 sallitaan: ilman tarkistetta / IMEISV). Välilyönnit ja viivat poistetaan.
      const m = v.replace(/[\s\-/.]/g, '').match(/(?<!\d)\d{14,16}(?!\d)/);
      if (!m) return;
      v = m[0];
    }
    if (f.type === 'iccid') {
      // SIM-kortin ICCID alkaa aina 89 ja on 18–22 merkkiä (voi päättyä F-kirjaimeen).
      // Käsin syötetty numero (esim. Miradoren oma kenttä) hyväksytään, jos siinä on vähintään 6 numeroa.
      const compact = v.replace(/[\s\-]/g, '');
      const m = compact.match(/(?<!\d)89\d{16,20}F?(?![\dA-Z])/i);
      if (m) v = m[0].toUpperCase();
      else if (/^\+?[\d\s\-/]+$/.test(v) && compact.replace(/\D/g, '').length >= 6) v = v.trim();
      else return;
    }
    if (f.type === 'pin') {
      // PIN = 4–8 numeroa.
      const m = v.replace(/\s/g, '').match(/^\d{4,8}$/);
      if (!m) return;
      v = m[0];
    }
    if (!best[key] || score > best[key].score) best[key] = { value: v, score, method };
  }

  // Piilotetut elementit (esim. SPA:n vanhat näkymät, välilehdet) ohitetaan.
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const firstVisible = sel => Array.from(document.querySelectorAll(sel)).find(visible) || null;

  const valueOf = el => {
    if (!el) return '';
    if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) return el.value;
    if (el.tagName === 'SELECT') return el.selectedOptions[0]?.text || el.value;
    const inner = el.querySelector?.('input:not([type=hidden]), textarea, select');
    if (inner && !clean(el.innerText).trim()) return valueOf(inner);
    return el.innerText || el.textContent;
  };

  let source = '';
  // Miradore MDM: ei omaa DOM-profiilia, kentät löytyvät yleisellä tunnistuksella
  // (Device / IMEI / Serial number / ICCID). Lähde näytetään popupissa.
  if (/miradore/i.test(location.hostname)) source = 'Miradore';

  // --- Profiili: 3stepIT ---------------------------------------------------
  const stepTable = firstVisible('table.dc-table-info');
  if (stepTable) {
    source = '3stepIT';
    for (const tr of stepTable.querySelectorAll('tr')) {
      const th = tr.querySelector('th');
      const td = tr.querySelector('td');
      const key = th && td && synMap.get(norm(th.innerText));
      if (key) offer(key, td.innerText, 100, '3stepIT', norm(th.innerText));
    }
  }

  // --- Profiili: Tesma -----------------------------------------------------
  const tesmaHead = firstVisible('.c-content__subheadline .text') ||
                    firstVisible('.c-breadCrumb__linkItem.active');
  if (tesmaHead && /sarjanumero\s*:/i.test(tesmaHead.innerText)) {
    source = source || 'Tesma';
    const txt = tesmaHead.innerText.replace(/^\s*kohde\s*:/i, '');
    const [nimi, sn] = txt.split(/\s+-\s+sarjanumero\s*:/i);
    offer('nimi', nimi, 100, 'Tesma');
    offer('sn', sn, 100, 'Tesma');
    const props = Array.from(document.querySelectorAll('.property')).filter(visible).map(e => e.innerText.trim());
    const id = props.find(p => /^\d{9,}$/.test(p));
    if (id) offer('idNum', id, 95, 'Tesma');
    const dates = props.filter(p => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(p));
    if (dates.length) offer('loppu', dates[dates.length - 1], 90, 'Tesma');
  }

  // --- Yleinen: otsikkoelementti + viereinen arvo --------------------------
  const all = document.body ? document.body.getElementsByTagName('*') : [];
  for (const el of all) {
    if (el.childElementCount > 3) continue;
    if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|OPTION|HEAD|TITLE)$/i.test(el.tagName)) continue;
    const txt = el.textContent;
    if (!txt || txt.length > 60) continue;
    const key = synMap.get(norm(txt));
    if (!key || !visible(el)) continue;

    const strong = /^(TH|TD|DT|LABEL)$/.test(el.tagName) ? 80 : 70;

    if (el.tagName === 'LABEL') {
      const target = el.htmlFor ? document.getElementById(el.htmlFor) : el.querySelector('input, select, textarea');
      if (target) offer(key, valueOf(target), 85, 'lomake', norm(txt));
    }

    // <b>Sarjanumero:</b> ABC123   (arvo tekstisolmuna heti perässä)
    const nextNode = el.nextSibling;
    if (nextNode && nextNode.nodeType === 3 && nextNode.textContent.trim()) {
      offer(key, nextNode.textContent, strong, 'vieressä', norm(txt));
    }
    const sib = el.nextElementSibling;
    if (sib) {
      offer(key, valueOf(sib), strong, 'vieressä', norm(txt));
    } else if (el.parentElement && norm(el.parentElement.textContent) === norm(txt) &&
               el.parentElement.nextElementSibling) {
      offer(key, valueOf(el.parentElement.nextElementSibling), strong - 5, 'vieressä', norm(txt));
    }
  }

  // --- Yleinen: "Otsikko: arvo" vapaasta tekstistä --------------------------
  const synList = Array.from(synMap.keys()).sort((a, b) => b.length - a.length);
  if (synList.length && document.body) {
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\-‐‑–]+');
    const re = new RegExp('(?:^|[^\\p{L}\\p{N}])(' + synList.map(esc).join('|') + ')\\s*[:：]', 'giu');
    const lines = (document.body.innerText || '').split(/\r?\n/);
    for (const line of lines) {
      if (line.length > 400) continue;
      re.lastIndex = 0;
      const hits = [];
      let m;
      while ((m = re.exec(line))) hits.push({ start: m.index, end: m.index + m[0].length, syn: m[1] });
      hits.forEach((h, i) => {
        const val = line.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : line.length);
        const key = synMap.get(norm(h.syn));
        if (key) offer(key, val, 40, 'teksti', norm(h.syn));
      });
    }
  }

  return { source, url: location.href, fields: best };
}
