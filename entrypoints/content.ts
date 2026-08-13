export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('[POC] Content script loaded');

    browser.runtime.onMessage.addListener((message, sender) => {
      if (message.type === "PING") {
        console.log("[POC] Received PING");

        return Promise.resolve({
          success: true,
          message: "Content Script Connected!",
          url: window.location.href,
        })
      }
    });
  },
});
