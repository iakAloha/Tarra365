const $ = s => document.querySelector(s);
let settings;

(async () => {
  settings = await tarraLoadSettings();
  fill();
})();

function fill() {
  const box = $('#fields');
  box.textContent = '';
  const title = $('#titleField');
  title.textContent = '';
  title.add(new Option('(ei otsikkoriviä)', ''));

  for (const f of TARRA_FIELDS) {
    const conf = settings.fields[f.key];
    title.add(new Option(f.name, f.key));
    const div = document.createElement('div');
    div.className = 'f';
    div.dataset.key = f.key;
    div.innerHTML = `
      <h3><span class="n"></span><label><input type="checkbox" class="show"> näytä tarralla</label></h3>
      <label class="blk">Teksti tarralla arvon edessä
        <input type="text" class="tag" maxlength="30"></label>
      <label class="blk">Tunnistettavat otsikot
        <textarea class="syn" spellcheck="false"></textarea></label>`;
    div.querySelector('.n').textContent = f.name;
    div.querySelector('.show').checked = !!conf.show;
    div.querySelector('.tag').value = conf.tag || '';
    div.querySelector('.syn').value = (conf.synonyms || []).join('\n');
    box.appendChild(div);
  }

  title.value = settings.titleField || '';
  $('#fontSize').value = settings.fontSize;
  $('#padding').value = settings.padding;
  $('#barcodeHeight').value = settings.barcodeHeight;
  $('#extraText').value = settings.extraText || '';
}

function collect() {
  for (const div of document.querySelectorAll('.f')) {
    const conf = settings.fields[div.dataset.key];
    conf.show = div.querySelector('.show').checked;
    conf.tag = div.querySelector('.tag').value.trim();
    conf.synonyms = div.querySelector('.syn').value.split('\n').map(s => s.trim()).filter(Boolean);
  }
  settings.titleField = $('#titleField').value;
  settings.fontSize = Math.min(24, Math.max(5, +$('#fontSize').value || 10));
  settings.padding = Math.min(10, Math.max(0, +$('#padding').value || 0));
  settings.barcodeHeight = Math.min(30, Math.max(3, +$('#barcodeHeight').value || 7));
  settings.extraText = $('#extraText').value.trim();
}

function flash(msg) {
  $('#saved').textContent = msg;
  setTimeout(() => { $('#saved').textContent = ''; }, 2000);
}

$('#save').addEventListener('click', async () => {
  collect();
  await tarraSaveSettings(settings);
  flash('Tallennettu ✓');
});

$('#reset').addEventListener('click', async () => {
  if (!confirm('Palautetaanko kaikki asetukset oletuksiin?')) return;
  settings = tarraClone(TARRA_DEFAULTS);
  await tarraSaveSettings(settings);
  fill();
  flash('Oletukset palautettu');
});

$('#clearHistory').addEventListener('click', async () => {
  await chrome.storage.local.remove('history');
  flash('Historia tyhjennetty');
});
