document.getElementById('keraaTiedot').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: keraaTiedotJoukosta,
  });

  // Etsitään ensimmäinen raami, joka palautti validia dataa
  const validResult = results.find(res => res.result && res.result.idNum !== 'Ei löydy');

  if (validResult) {
    const data = validResult.result;
    document.getElementById('idNum').innerText = data.idNum;
    document.getElementById('nimi').innerText = data.nimi;
    document.getElementById('sn').innerText = data.sn;
    document.getElementById('loppu').innerText = data.loppu;
  } else {
    alert("Tietoja ei löytynyt kummastakaan järjestelmästä (3stepIT/Tesma).");
  }
});

function keraaTiedotJoukosta() {
  // --- LOGIIKKA A: Tesma-järjestelmä ---
  function haeTesmasta() {
    // Tesmassa nimi ja SN löytyvät suoraan otsikosta/breadcrumbista
    const headline = document.querySelector('.c-breadCrumb__linkItem.active')?.innerText || "";
    const subheadline = document.querySelector('.c-content__subheadline .text')?.innerText || "";
    
    // Etsitään "KOHDE: [NIMI] - Sarjanumero: [SN]"
    let nimi = "Ei löydy";
    let sn = "Ei löydy";
    
    const hakuTeksti = subheadline || headline;
    if (hakuTeksti.includes("Sarjanumero:")) {
      const osat = hakuTeksti.replace("KOHDE:", "").split("- Sarjanumero:");
      nimi = osat[0]?.trim();
      sn = osat[1]?.trim();
    }

    // Etsitään ID ja Päivämäärä "property"-luokista
    // Tesmassa ID on usein ensimmäinen "property" ja Päivämäärä se, joka sisältää pisteitä
    const properties = Array.from(document.querySelectorAll('.property'));
    const idNum = properties.find(el => /^\d{9,}$/.test(el.innerText.trim()))?.innerText.trim() || "Ei löydy";
    
    // Päättymispäivä on yleensä viimeinen päivämäärä sivulla
    const paivamaarat = properties.filter(el => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(el.innerText.trim()));
    const loppu = paivamaarat.length > 0 ? paivamaarat[paivamaarat.length - 1].innerText.trim() : "Ei löydy";

    if (idNum !== "Ei löydy" || sn !== "Ei löydy") {
      return { idNum, nimi, sn, loppu };
    }
    return null;
  }

  // --- LOGIIKKA B: 3stepIT-järjestelmä ---
  function hae3stepIT() {
    const taulukko = document.querySelector('table.dc-table-info');
    if (!taulukko) return null;

    function haeArvo(otsikkoTeksti) {
      const rivit = Array.from(taulukko.querySelectorAll('tr'));
      for (let rivi of rivit) {
        const th = rivi.querySelector('th');
        const td = rivi.querySelector('td');
        if (th && td && th.innerText.trim().toLowerCase() === otsikkoTeksti.toLowerCase()) {
          return td.innerText.split('\n')[0].trim();
        }
      }
      return null;
    }

    const idNum = haeArvo('Laite #');
    if (!idNum) return null;

    return {
      idNum: idNum,
      nimi: haeArvo('Laitteen nimi') || 'Ei löydy',
      sn: haeArvo('Sarjanumero') || 'Ei löydy',
      loppu: haeArvo('Päättymispäivä') || 'Ei löydy'
    };
  }

  // Kokeillaan ensin 3stepIT:tä, sitten Tesmaa
  return hae3stepIT() || haeTesmasta() || { idNum: 'Ei löydy' };
}