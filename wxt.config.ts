import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ["debugger", "windows", "tabs", "system.display", "declarativeNetRequest", "webNavigation"],
  },
});
