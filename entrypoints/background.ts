const IG_MATCH = "*://*.instagram.com/*";
const POPUP_PAGE = "popup.html";

function isInstagram(url?: string) {
  return !!url && /^https?:\/\/([^/]+\.)?instagram\.com\//.test(url);
}

async function syncPopup(tabId: number, url?: string) {
  await browser.action.setPopup({
    tabId,
    popup: isInstagram(url) ? POPUP_PAGE : "",
  });
}

async function focusOrOpenInstagram() {
  const tabs = await browser.tabs.query({ url: IG_MATCH });
  if (tabs.length > 0 && tabs[0].id !== undefined) {
    await browser.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId !== undefined) {
      await browser.windows.update(tabs[0].windowId, { focused: true });
    }
  } else {
    await browser.tabs.create({ url: "https://www.instagram.com/" });
  }
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(focusOrOpenInstagram);

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading" || changeInfo.url) {
      void syncPopup(tabId, tab.url);
    }
  });

  const initAll = async () => {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id !== undefined) await syncPopup(tab.id, tab.url);
    }
  };

  browser.runtime.onInstalled.addListener(initAll);
  browser.runtime.onStartup.addListener(initAll);
  void initAll();
});
