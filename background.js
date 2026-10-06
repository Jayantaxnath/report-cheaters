chrome.action.onClicked.addListener(tab => {
  if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'lcrh-toggle' }).catch(() => {});
});

// sends the icon to the page as a data: URL
chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  if (!m || m.type !== 'lcrh-get-icon') return;
  fetch(chrome.runtime.getURL('icon.png'))
    .then(r => r.arrayBuffer())
    .then(buf => {
      const u = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
      sendResponse('data:image/png;base64,' + btoa(bin));
    })
    .catch(() => sendResponse(null));
  return true; // keep the channel open for the async reply
});
