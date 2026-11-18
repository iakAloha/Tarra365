// Avataan popup automaattisesti uudelleen, kun arvo on poimittu sivulta.
// chrome.action.openPopup toimii Chrome 127+; vanhemmissa käyttäjä avaa popupin itse.
chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'tarraPickDone' && chrome.action.openPopup) {
    chrome.action.openPopup().catch(() => {});
  }
});
