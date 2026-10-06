// isolated-world bridge: toolbar icon click -> page-world content.js, and publishes the icon
chrome.runtime.onMessage.addListener(m => {
  if (m && m.type === 'lcrh-toggle') window.dispatchEvent(new CustomEvent('lcrh-toggle'));
});

// the background worker reads the icon file (no page CSP / web_accessible_resources involved)
chrome.runtime.sendMessage({ type: 'lcrh-get-icon' })
  .then(url => {
    if (!url) throw new Error('background returned no icon');
    document.documentElement.dataset.lcrhIcon = url;
    window.dispatchEvent(new CustomEvent('lcrh-icon'));
  })
  .catch(e => console.warn('[LC Report Helper] icon load failed:', e));
