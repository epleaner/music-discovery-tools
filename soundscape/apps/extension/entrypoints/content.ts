export default defineContentScript({
  matches: ['*://*.example.com/*'],
  main() {
    console.log(
      'Soundscape content script loaded on:',
      window.location.hostname
    );
  },
});
