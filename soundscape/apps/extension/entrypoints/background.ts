export default defineBackground(() => {
  console.log('Soundscape background script loaded');

  // Listen for installation
  chrome.runtime.onInstalled.addListener(() => {
    console.log('Soundscape extension installed');
  });
});
