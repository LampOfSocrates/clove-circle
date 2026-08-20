// Google Analytics 4 — swap MEASUREMENT_ID if the data stream changes.
(function () {
  var MEASUREMENT_ID = 'G-RBTNS3ZZP2';

  // Skip local/preview runs so test traffic never reaches the property.
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '' || location.protocol === 'file:') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);
})();
