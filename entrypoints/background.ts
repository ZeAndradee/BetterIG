export default defineBackground(() => {
  browser.action.onClicked.addListener(async () => {
    const tabs = await browser.tabs.query({ url: "*://*.instagram.com/*" });
    if (tabs.length > 0 && tabs[0].id !== undefined) {
      await browser.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId !== undefined) {
        await browser.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      await browser.tabs.create({ url: "https://www.instagram.com/" });
    }
  });
});
