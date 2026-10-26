/* ============================================================
   Mensura — Global app shell
   Theme toggle · Mobile menu · FAQ accordion · Search · Copy
   Pure vanilla JS, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Theme ---------- */
  var THEME_KEY = 'mensura-theme';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = t === 'light' ? '☾' : '☀';
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!saved) {
      saved = window.matchMedia &&
              window.matchMedia('(prefers-color-scheme: light)').matches
              ? 'light' : 'dark';
    }
    applyTheme(saved);
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      });
    }
  }

  /* ---------- Mobile menu ---------- */
  function initMenu() {
    var t = document.getElementById('menuToggle');
    var m = document.getElementById('navLinks');
    if (t && m) {
      t.addEventListener('click', function () { m.classList.toggle('open'); });
    }
  }

  /* ---------- FAQ accordion ---------- */
  function initFaq() {
    document.querySelectorAll('.faq-item .faq-q').forEach(function (q) {
      q.addEventListener('click', function () {
        var item = q.closest('.faq-item');
        var wasOpen = item.classList.contains('open');
        // close siblings for a cleaner feel
        var wrap = q.closest('.faq');
        if (wrap) {
          wrap.querySelectorAll('.faq-item.open').forEach(function (o) {
            o.classList.remove('open');
            var b = o.querySelector('.faq-q');
            if (b) b.setAttribute('aria-expanded', 'false');
          });
        }
        if (!wasOpen) {
          item.classList.add('open');
          q.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- Copy to clipboard ---------- */
  function initCopy() {
    /* Event delegation: buttons injected later by tools.js still work. */
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-copy-target]') : null;
      if (!btn) return;
      {
        var el = document.querySelector(btn.getAttribute('data-copy-target'));
        if (!el) return;
        var text = el.textContent || el.value || '';
        var done = function () {
          var old = btn.textContent;
          btn.textContent = 'Copied ✓';
          setTimeout(function () { btn.textContent = old; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else { fallback(); }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      }
    });
  }

  /* ---------- Search ---------- */
  var SEARCH_INDEX = [
    ['Length Converter',        '/tools/length-converter.html',        'Unit Converters'],
    ['Weight Converter',        '/tools/weight-converter.html',        'Unit Converters'],
    ['Temperature Converter',   '/tools/temperature-converter.html',   'Unit Converters'],
    ['Volume Converter',        '/tools/volume-converter.html',        'Unit Converters'],
    ['Area Converter',          '/tools/area-converter.html',          'Unit Converters'],
    ['Data Storage Converter',  '/tools/data-storage-converter.html',  'Unit Converters'],
    ['Speed Converter',         '/tools/speed-converter.html',         'Unit Converters'],
    ['Shoe Size Converter',     '/tools/shoe-size-converter.html',     'Unit Converters'],
    ['Fuel Economy Converter',  '/tools/fuel-economy-converter.html',  'Unit Converters'],
    ['Cooking Converter',       '/tools/cooking-converter.html',       'Unit Converters'],
    ['Percentage Calculator',   '/tools/percentage-calculator.html',   'Math'],
    ['Average & Std Dev',       '/tools/average-calculator.html',      'Math'],
    ['GCD & LCM Calculator',    '/tools/gcd-lcm-calculator.html',      'Math'],
    ['Fraction Calculator',     '/tools/fraction-calculator.html',     'Math'],
    ['Date Duration Calculator','/tools/date-duration-calculator.html','Date & Time'],
    ['Age Calculator',          '/tools/age-calculator.html',          'Date & Time'],
    ['Unix Timestamp Converter','/tools/unix-timestamp-converter.html','Date & Time'],
    ['Base64 Encoder/Decoder',  '/tools/base64-tool.html',             'Developer'],
    ['URL Encoder/Decoder',     '/tools/url-encoder.html',             'Developer'],
    ['Word & Character Counter','/tools/word-counter.html',            'Developer']
  ];

  function initSearch() {
    var input = document.getElementById('searchInput');
    var box   = document.getElementById('searchResults');
    if (!input || !box) return;

    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { box.classList.remove('show'); box.innerHTML = ''; return; }
      var hits = SEARCH_INDEX.filter(function (it) {
        return it[0].toLowerCase().indexOf(q) > -1 ||
               it[2].toLowerCase().indexOf(q) > -1;
      }).slice(0, 10);
      if (!hits.length) {
        box.innerHTML = '<a href="#" onclick="return false">No tools found</a>';
        box.classList.add('show'); return;
      }
      box.innerHTML = hits.map(function (it) {
        return '<a href="' + it[1] + '">' + it[0] +
               '<span class="sr-cat">' + it[2] + '</span></a>';
      }).join('');
      box.classList.add('show');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-wrap')) box.classList.remove('show');
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initTheme();
    initMenu();
    initFaq();
    initCopy();
    initSearch();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  /* expose for tool scripts */
  window.MensuraSearchIndex = SEARCH_INDEX;
})();
