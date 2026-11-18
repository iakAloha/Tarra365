(async () => {
  const { printJob } = await chrome.storage.local.get('printJob');
  const box = document.getElementById('labels');
  if (!printJob) {
    box.textContent = 'Ei tulostettavaa tarraa.';
    return;
  }

  const s = tarraMerge(tarraClone(TARRA_DEFAULTS), printJob.settings);
  const size = tarraSize(s);

  const st = document.createElement('style');
  st.textContent = `@page { size: ${size.w}mm ${size.h}mm; margin: 0; }
    .page { width: ${size.w}mm; height: ${size.h}mm; }`;
  document.head.appendChild(st);

  const copies = Math.min(50, Math.max(1, +printJob.copies || 1));
  for (let i = 0; i < copies; i++) {
    const page = document.createElement('div');
    page.className = 'page';
    box.appendChild(page);
    renderLabel(page, printJob.values, s);
  }

  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  window.addEventListener('afterprint', () => setTimeout(() => window.close(), 200));
  window.print();
})();
