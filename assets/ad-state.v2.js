/* Ad slot empty-state handling.
   Detects whether the ad unit has been filled, removes the inline height
   written on an unfilled unit, and toggles the filled class on the wrapper.
   No duplicate ad request: the native push call already lives in the HTML. */
(function () {
  'use strict';
  var POLL_DELAYS = [0, 120, 400, 600, 1200, 1800, 3000, 4000, 6000];
  var MAX_PASSES = 20;

  function isFilled(ins) {
    var status = ins.getAttribute('data-ad-status');
    if (status === 'filled') return true;
    if (status === 'unfilled' || status === 'error') return false;
    var frames = ins.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i], cs = window.getComputedStyle(frame);
      if (cs.display !== 'none' && cs.visibility !== 'hidden' &&
          (frame.getBoundingClientRect().height || frame.offsetHeight || 0) > 40) return true;
    }
    return false;
  }

  function stripInlineHeight(ins, slot) {
    var passes = ins.__pmAdPasses || 0;
    if (passes >= MAX_PASSES) return;
    ins.__pmAdPasses = passes + 1;
    [ins, slot].forEach(function (el) {
      if (el && el.style && el.style.getPropertyValue('height')) el.style.removeProperty('height');
    });
  }

  function sync(ins) {
    var slot = ins.closest('.pm-ad');
    if (!slot) return;
    var on = isFilled(ins);
    slot.classList.toggle('pm-filled', on);
    if (!on) stripInlineHeight(ins, slot);
  }

  function init() {
    document.querySelectorAll('.pm-ad > ins.adsbygoogle').forEach(function (ins) {
      sync(ins);
      if (typeof MutationObserver === 'function') {
        new MutationObserver(function () { sync(ins); }).observe(ins, {
          attributes: true, attributeFilter: ['data-ad-status', 'style'],
          childList: true, subtree: true
        });
      }
      POLL_DELAYS.forEach(function (d) { setTimeout(function () { sync(ins); }, d); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
