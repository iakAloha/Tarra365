// Yhteiset määritykset: kentät, tarrakoot ja oletusasetukset.
// Ladataan popupissa, asetussivulla ja tulostussivulla.

const TARRA_FIELDS = [
  { key: 'idNum', name: 'Laitenumero', type: 'text' },
  { key: 'nimi',  name: 'Laitteen nimi', type: 'text' },
  { key: 'sn',    name: 'Sarjanumero', type: 'text' },
  { key: 'imei',  name: 'IMEI', type: 'imei' },
  { key: 'sim',   name: 'SIM-kortin numero', type: 'iccid' },
  { key: 'simPin', name: 'SIM-kortin PIN', type: 'pin' },
  { key: 'loppu', name: 'Leasing päättyy', type: 'date' }
];

// Kasvatetaan, kun oletusotsikoita lisätään: vanhoihin tallennettuihin
// asetuksiin yhdistetään silloin uudet oletusotsikot.
const TARRA_SETTINGS_VERSION = 3;

const TARRA_SIZES = {
  '99012':  { name: 'DYMO 99012 – 89 × 36 mm', w: 89,  h: 36 },
  '99010':  { name: 'DYMO 99010 – 89 × 28 mm', w: 89,  h: 28 },
  '11354':  { name: 'DYMO 11354 – 57 × 32 mm', w: 57,  h: 32 },
  '11352':  { name: 'DYMO 11352 – 54 × 25 mm', w: 54,  h: 25 },
  '99014':  { name: 'DYMO 99014 – 101 × 54 mm', w: 101, h: 54 },
  'custom': { name: 'Oma koko…', w: null, h: null }
};

const TARRA_DEFAULTS = {
  fields: {
    idNum: {
      show: true,
      tag: 'Laite #',
      synonyms: ['Laite #', 'Laite nro', 'Laitenumero', 'Laitenro', 'Laite ID', 'Inventaarionumero',
                 'Inventaarionro', 'Asset tag', 'Asset #', 'Asset number', 'Asset ID', 'Device #']
    },
    nimi: {
      show: true,
      tag: '',
      synonyms: ['Laitteen nimi', 'Laitenimi', 'Laite', 'Nimi', 'Malli', 'Tuote', 'Kohde', 'Tuotenimi',
                 'Device', 'Device name', 'Model', 'Product', 'Product name']
    },
    sn: {
      show: true,
      tag: 'S/N',
      synonyms: ['Sarjanumero', 'Sarjanro', 'Sarja nro', 'S/N', 'SN', 'Serial number', 'Serial no',
                 'Serial', 'Service tag']
    },
    imei: {
      show: true,
      tag: 'IMEI',
      synonyms: ['IMEI', 'IMEI 1', 'IMEI1', 'IMEI-koodi', 'IMEI-numero', 'IMEI number', 'MEID']
    },
    sim: {
      show: true,
      tag: 'SIM',
      synonyms: ['SIM-kortin numero', 'SIM-kortin nro', 'SIM-kortti', 'SIM-numero', 'SIM', 'ICCID',
                 'SIM card number', 'SIM number', 'SIM card', 'ICC ID']
    },
    simPin: {
      show: true,
      tag: 'PIN',
      synonyms: ['SIM-kortin PIN', 'SIM-kortin PIN-koodi', 'SIM PIN', 'SIM-PIN', 'PIN-koodi', 'PIN',
                 'SIM PIN code', 'PIN code']
    },
    loppu: {
      show: true,
      tag: 'Päättyy',
      synonyms: ['Päättymispäivä', 'Leasing päättyy', 'Sopimus päättyy', 'Sopimuksen päättymispäivä',
                 'Vuokra päättyy', 'Vuokrasopimus päättyy', 'Loppupäivä', 'Päättyy',
                 'End date', 'Lease end', 'Lease end date', 'Contract end', 'Expiration date']
    }
  },
  titleField: 'nimi',     // korostettu otsikkorivi
  size: '99012',
  customW: 89,
  customH: 36,
  barcode: 'idNum',       // 'none' | kentän avain
  barcodeHeight: 7,       // mm
  fontSize: 10,           // pt, maksimi – pienennetään automaattisesti
  padding: 2,             // mm
  extraText: '',          // esim. "Omaisuutta: Yritys Oy"
  copies: 1
};

function tarraClone(o) { return JSON.parse(JSON.stringify(o)); }

function tarraMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      tarraMerge(base[k], v);
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

async function tarraLoadSettings() {
  const { settings } = await chrome.storage.sync.get('settings');
  const merged = tarraMerge(tarraClone(TARRA_DEFAULTS), settings || {});
  if (settings && (settings.version || 1) < TARRA_SETTINGS_VERSION) {
    // Päivitys: lisätään uudet oletusotsikot käyttäjän omien rinnalle.
    for (const [k, def] of Object.entries(TARRA_DEFAULTS.fields)) {
      const own = merged.fields[k].synonyms || [];
      const lower = new Set(own.map(s => s.toLowerCase()));
      merged.fields[k].synonyms = own.concat(def.synonyms.filter(s => !lower.has(s.toLowerCase())));
    }
  }
  merged.version = TARRA_SETTINGS_VERSION;
  return merged;
}

function tarraSaveSettings(s) {
  s.version = TARRA_SETTINGS_VERSION;
  return chrome.storage.sync.set({ settings: s });
}

function tarraSize(s) {
  if (s.size === 'custom') return { w: +s.customW || 89, h: +s.customH || 36 };
  return TARRA_SIZES[s.size] || TARRA_SIZES['99012'];
}
