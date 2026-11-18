# Tarra365 2.2 – Chrome-lisäosa laitetarroille

Tunnistaa laitteen tiedot avoimelta sivulta ja tulostaa ne DYMO-tarralle.

## Asennus

1. Avaa `chrome://extensions` ja kytke **Kehittäjätila** päälle.
2. **Lataa pakkaamaton laajennus** → valitse tämä kansio (`uusi`).
3. Kiinnitä kuvake työkalupalkkiin. Pikanäppäin: **Alt+Shift+T**.

## Käyttö

1. Avaa laitteen tietosivu (3stepIT, Tesma, Miradore tai mikä tahansa sivu, jolla on otsikko–arvo-pareja).
2. Avaa Tarra365. Tiedot haetaan automaattisesti, ja kunkin kentän vieressä näkyy, mistä arvo löytyi.
3. Korjaa kenttiä tarvittaessa, tai paina **⌖** ja klikkaa arvoa sivulla. Voit myös maalata osan tekstistä ennen klikkausta.
4. Valitse tarrakoko ja viivakoodi ja paina **Tulosta tarra** (tai **Ctrl+Enter**).

Ensimmäisellä tulostuskerralla valitse tulostusikkunassa DYMO-tulostin ja kohdasta *Lisää asetuksia* aseta
**Paperikoko** = tarran koko, **Marginaalit** = Ei mitään ja **Mittakaava** = 100 %. Chrome muistaa valinnat.

## Tunnistus

Järjestyksessä vahvimmasta heikoimpaan (paras pistemäärä voittaa kentittäin, kaikki kehykset/iframet käydään läpi):

| Tapa | Esimerkki |
|---|---|
| 3stepIT-profiili | `table.dc-table-info` → `th`/`td` |
| Tesma-profiili | `KOHDE: <nimi> - Sarjanumero: <SN>` + `.property`-kentät |
| Lomake | `<label for>` → `<input>` |
| Otsikko + viereinen arvo | `th`/`td`, `dt`/`dd`, `<b>Malli:</b> Dell …` |
| Vapaa teksti | `Laite nro: 998877 \| Sarjanumero: ABCD-1` |

Kentät: laitenumero, laitteen nimi, sarjanumero, IMEI, SIM-kortin numero, SIM-kortin PIN ja leasingin päättymispäivä.
Tyhjiä kenttiä ei tulosteta, joten sama pohja sopii sekä tietokoneille (3stepIT/Tesma) että puhelimille (Miradore).

**Miradore** tunnistetaan yleisellä tunnistuksella otsikoista *Device*, *IMEI*, *Serial number* / *SN* ja
*ICCID* / *SIM kortin numero* sekä Miradoren omista lisäkentistä (*SIM kortin PIN*, *SIM kortin numero*, arvo
`<input>`-kentässä). Väliviiva ja välilyönti otsikossa tulkitaan samaksi. Arvot tarkistetaan: IMEI 14–16 numeroa,
SIM-numero ICCID (89…) tai vähintään 6 numeroa, PIN 4–8 numeroa – joten "Not available" yms. ohitetaan.

Piilotetut elementit ohitetaan. Päivämäärät muutetaan muotoon `p.k.vvvv` (`2028-06-30` → `30.6.2028`).
Tunnistettavia otsikoita voi lisätä asetussivulla (⚙).

## Tiedostot

| Tiedosto | Tehtävä |
|---|---|
| `defaults.js` | kentät, tarrakoot, oletusasetukset |
| `extractor.js` | sivulle injektoitava tunnistusfunktio |
| `label.js` | tarran piirto ja Code 128 -viivakoodi (yhteinen esikatselulle ja tulosteelle) |
| `popup.*` | käyttöliittymä |
| `picker.js` | ⌖-poimintatila sivulla |
| `print.*` | tulostussivu (`@page`-koko = tarran koko) |
| `options.*` | asetukset |
| `background.js` | avaa popupin uudelleen poiminnan jälkeen (Chrome 127+) |

## Muutokset

**2.2** – SIM-kortin PIN -kenttä. Miradoren lisäkentät ("SIM kortin PIN/numero") tunnistuvat; väliviiva = välilyönti otsikoissa; SIM-numeroksi kelpaa myös käsin syötetty numero.

**2.1** – IMEI- ja SIM-kentät, Miradore-tuki. Uudet oletusotsikot lisätään automaattisesti aiemmin tallennettujen asetusten rinnalle.

**2.0** (vs. 1.x)

- Tulostus toimii (1.x:n "Tulosta tarra" -napilla ei ollut toimintoa).
- Tarran esikatselu, tarrakoot, viivakoodi ja automaattinen tekstin sovitus.
- Yleinen tunnistus kaikille sivuille, ei vain 3stepIT/Tesma. Otsikot muokattavissa.
- Kentät muokattavissa, ja arvon voi poimia klikkaamalla sivulta.
- Tulostushistoria, kopiointi leikepöydälle, monta kopiota.
- Rikkinäinen `mainifest.json` ja vanhentunut `popup_3step.js` poistettu, kuvakkeet käytössä.

## Jatkoideoita

- Suora tulostus ilman tulostusikkunaa DYMO Connect Web Servicen kautta (`https://127.0.0.1:41951`).
- Vaihtoehtoisesti Chromen `--kiosk-printing`-käynnistysvalitsin tulostaa suoraan oletustulostimelle.
