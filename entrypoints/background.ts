export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason !== "install") return;
    browser.tabs.create({ url: "https://www.instagram.com/" });
  });
});
