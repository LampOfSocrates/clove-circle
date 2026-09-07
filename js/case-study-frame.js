/* Shared behaviour for the embedded case-study wrappers.
 *
 * Every wrapper frames a standalone dashboard the same way, so the sizing and
 * reset wiring live here rather than being re-implemented per page. Markup
 * contract, on the iframe itself:
 *
 *   data-autofit                 grow the frame to its content's height
 *   data-reset-target="<id>"     id of the button that resets the dashboard
 *   data-reset-message="<msg>"   postMessage payload that dashboard listens for
 *
 * The CSS min-height ladder stays the floor: auto-fit can only make a frame
 * taller, so a dashboard that refuses to measure still renders at its tuned
 * height.
 */
(function () {
  'use strict';

  var frame = document.querySelector('.cc-case-study-frame');
  if (!frame) return;

  function measure() {
    try {
      var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      if (!doc || !doc.body || !doc.documentElement) return 0;
      return Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        doc.body.offsetHeight,
        doc.documentElement.offsetHeight
      );
    } catch (err) {
      // Same-origin in production; stay quiet if that ever stops holding.
      return 0;
    }
  }

  function fit() {
    if (!frame.hasAttribute('data-autofit')) return;
    // Measure at the frame's current height, never collapsed first: these
    // dashboards size parts of themselves off the viewport they are given, so
    // a zero-height frame measures as empty.
    var height = measure();
    if (height > 100) frame.style.height = height + 'px';
  }

  function fitSoon() {
    fit();
    window.setTimeout(fit, 150);
    window.setTimeout(fit, 600);
  }

  function observe() {
    try {
      new ResizeObserver(fit).observe(frame.contentDocument.body);
    } catch (err) {}
  }

  frame.addEventListener('load', function () {
    fitSoon();
    observe();
  });

  // A lazy-loaded frame can finish before this script runs, in which case the
  // load listener above never fires. Settle it here too.
  fitSoon();
  observe();

  // Dashboards that measure themselves push their height up to us.
  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || typeof data !== 'object') return;
    var height = data.phaHeight || data.frameHeight;
    if (typeof height === 'number' && height > 100) frame.style.height = height + 'px';
  });

  window.addEventListener('resize', fit);

  var resetId = frame.getAttribute('data-reset-target');
  var resetMessage = frame.getAttribute('data-reset-message');
  var resetBtn = resetId && document.getElementById(resetId);
  if (resetBtn && resetMessage) {
    resetBtn.addEventListener('click', function () {
      frame.contentWindow.postMessage(resetMessage, '*');
      fitSoon();
    });
  }
})();
