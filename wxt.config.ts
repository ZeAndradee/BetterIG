import { resolve } from "node:path";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "BetterIG",
    permissions: ["storage"],
    action: {
      default_title: "BetterIG",
      default_popup: "popup.html",
    },
    web_accessible_resources: [
      {
        resources: ["fonts/*"],
        matches: ["https://*.instagram.com/*"],
      },
    ],
  },
  webExt: {
    chromiumProfile: resolve(".wxt/chrome-data"),
    keepProfileChanges: true,
  },
});
