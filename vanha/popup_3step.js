document.getElementById('keraaTiedot').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: poimiTiedotTarkka,
  });

  const validResult = results.find(res => res.result && res.result.idNum !== 'Ei löydy');

  if (validResult) {
    const data = validResult.result;
    document.getElementById('idNum').innerText = data.idNum;
    document.getElementById('nimi').innerText = data.nimi;
    document.getElementById('sn').innerText = data.sn;
    document.getElementById('loppu').innerText = data.loppu;
  } else {
    alert("Tietoja ei löytynyt. Varmista, että laitteen tiedot ovat näkyvissä sivulla.");
  }
});

function poimiTiedotTarkka() {
  // Etsitään nimenomaan se taulukko, jonka HTML-koodissa näimme
  const taulukko = document.querySelector('table.dc-table-info');
  if (!taulukko) return null;

  function haeArvo(otsikkoTeksti) {
    const rivit = Array.from(taulukko.querySelectorAll('tr'));
    for (let rivi of rivit) {
      const otsikkoElementti = rivi.querySelector('th');
      const arvoElementti = rivi.querySelector('td');
      
      if (otsikkoElementti && arvoElementti) {
        if (otsikkoElementti.innerText.trim().toLowerCase() === otsikkoTeksti.toLowerCase()) {
          // Puhdistetaan arvo (otetaan vain ensimmäinen rivi ja poistetaan turhat välit)
          return arvoElementti.innerText.split('\n')[0].trim();
        }
      }
    }
    return null;
  }

  const res = {
    idNum: haeArvo('Laite #'),
    nimi: haeArvo('Laitteen nimi'),
    sn: haeArvo('Sarjanumero'),
    loppu: haeArvo('Päättymispäivä')
  };

  // Jos emme löytäneet edes ID-numeroa, hylätään tämä raami
  return res.idNum ? res : null;
}