// Google Analytics (gtag.js) initializer.
// Kept as an external same-origin file so the page CSP can stay strict
// (script-src 'self' …) without allowing 'unsafe-inline'.
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "G-EB21LZ7VB0", {
  allow_google_signals: false,
  allow_ad_personalization_signals: false
});
