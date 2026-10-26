/* ============================================================
   Mensura — Calculation engine
   All conversions use exact international definitions.
   No dependencies. Deterministic: same input → same output.
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     Strict number parsing
     parseFloat('12abc') === 12 is a silent lie — we reject it.
     ============================================================ */
  var NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  function parseNum(raw) {
    if (raw === null || raw === undefined) return NaN;
    var s = String(raw).trim().replace(/,/g, '');
    if (s === '') return NaN;
    if (!NUM_RE.test(s)) return NaN;
    var n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  /* ============================================================
     Number formatting
     ============================================================ */
  function fmt(n, sig) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    if (n === 0) return '0';
    var abs = Math.abs(n);
    if (abs >= 1e12 || (abs < 1e-6 && abs > 0)) {
      return n.toExponential(6).replace(/e([+-])(\d)$/, 'e$10$2');
    }
    var s;
    if (abs >= 1000)      s = n.toFixed(4);
    else if (abs >= 1)    s = n.toFixed(6);
    else if (abs >= 0.01) s = n.toFixed(7);
    else                  s = n.toFixed(9);
    // strip trailing zeros
    if (s.indexOf('.') > -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  function group(n) {
    var parts = String(n).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /* ---------- Zero-dependency UTF-8 helpers ----------
     TextEncoder/TextDecoder are unavailable in some environments,
     so encode/decode are implemented directly. */
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
      if (cp > 0xFFFF) i++;
      if (cp < 0x80)         out.push(cp);
      else if (cp < 0x800)   out.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
      else if (cp < 0x10000) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      else                   out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F),
                                      0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    }
    return out;
  }
  function utf8ToBinary(str) {
    return utf8Bytes(str).map(function (b) { return String.fromCharCode(b); }).join('');
  }
  function binaryToUtf8(bin) {
    var out = '', i = 0;
    while (i < bin.length) {
      var c = bin.charCodeAt(i);
      if (c < 0x80)      { out += String.fromCharCode(c); i += 1; }
      else if (c < 0xE0) { out += String.fromCharCode(((c & 0x1F) << 6) | (bin.charCodeAt(i + 1) & 0x3F)); i += 2; }
      else if (c < 0xF0) { out += String.fromCharCode(((c & 0x0F) << 12) | ((bin.charCodeAt(i + 1) & 0x3F) << 6) |
                                                     (bin.charCodeAt(i + 2) & 0x3F)); i += 3; }
      else {
        var cp = ((c & 0x07) << 18) | ((bin.charCodeAt(i + 1) & 0x3F) << 12) |
                 ((bin.charCodeAt(i + 2) & 0x3F) << 6) | (bin.charCodeAt(i + 3) & 0x3F);
        out += String.fromCodePoint(cp); i += 4;
      }
    }
    return out;
  }

  /* ============================================================
     Unit conversion engine
     ============================================================ */
  var UNIT_DEFS = {
    length: {
      units: [
        { id: 'nm',  name: 'Nanometer',      sym: 'nm',  f: 1e-9 },
        { id: 'um',  name: 'Micrometer',     sym: 'µm',  f: 1e-6 },
        { id: 'mm',  name: 'Millimeter',     sym: 'mm',  f: 0.001 },
        { id: 'cm',  name: 'Centimeter',     sym: 'cm',  f: 0.01 },
        { id: 'm',   name: 'Meter',          sym: 'm',   f: 1 },
        { id: 'km',  name: 'Kilometer',      sym: 'km',  f: 1000 },
        { id: 'in',  name: 'Inch',           sym: 'in',  f: 0.0254 },
        { id: 'ft',  name: 'Foot',           sym: 'ft',  f: 0.3048 },
        { id: 'yd',  name: 'Yard',           sym: 'yd',  f: 0.9144 },
        { id: 'mi',  name: 'Mile',           sym: 'mi',  f: 1609.344 },
        { id: 'nmi', name: 'Nautical Mile',  sym: 'nmi', f: 1852 }
      ],
      def: 'm'
    },
    /* Everyday mass only (avoirdupois). Values are exact: the pound is
       defined as 0.45359237 kg by the 1959 international agreement. */
    weight: {
      units: [
        { id: 'mg', name: 'Milligram',  sym: 'mg', f: 1e-6 },
        { id: 'g',  name: 'Gram',       sym: 'g',  f: 0.001 },
        { id: 'kg', name: 'Kilogram',   sym: 'kg', f: 1 },
        { id: 't',  name: 'Metric Ton', sym: 't',  f: 1000 },
        { id: 'oz', name: 'Ounce',      sym: 'oz', f: 0.028349523125 },
        { id: 'lb', name: 'Pound',      sym: 'lb', f: 0.45359237 },
        { id: 'st', name: 'Stone',      sym: 'st', f: 6.35029318 }
      ],
      def: 'kg',
      mainUnit: 'lb'
    },
    volume: {
      units: [
        { id: 'ml',    name: 'Milliliter',            sym: 'mL',       f: 0.001 },
        { id: 'l',     name: 'Liter',                 sym: 'L',        f: 1 },
        { id: 'cm3',   name: 'Cubic Centimeter',      sym: 'cm³',      f: 0.001 },
        { id: 'm3',    name: 'Cubic Meter',           sym: 'm³',       f: 1000 },
        { id: 'inus',  name: 'Cubic Inch',            sym: 'in³',      f: 0.016387064 },
        { id: 'ft3',   name: 'Cubic Foot',            sym: 'ft³',      f: 28.316846592 },
        { id: 'galus', name: 'Gallon (US)',           sym: 'gal (US)', f: 3.785411784 },
        { id: 'galuk', name: 'Gallon (UK / Imperial)',sym: 'gal (UK)', f: 4.54609 },
        { id: 'qtus',  name: 'Quart (US)',            sym: 'qt (US)',  f: 0.946352946 },
        { id: 'ptus',  name: 'Pint (US)',             sym: 'pt (US)',  f: 0.473176473 },
        { id: 'flozus',name: 'Fluid Ounce (US)',      sym: 'fl oz (US)', f: 0.0295735295625 },
        { id: 'flozuk',name: 'Fluid Ounce (UK)',      sym: 'fl oz (UK)', f: 0.0284130625 },
        { id: 'cupus', name: 'Cup (US, 240 mL)',      sym: 'cup (US)', f: 0.24 },
        /* US legal set — mutually consistent with the 240 mL legal cup above:
           1 cup = 16 tbsp = 48 tsp. (The customary set is 236.588 / 14.787 / 4.929 mL;
           mixing the two is what makes many converters report 16.23 tbsp per cup.) */
        { id: 'tbsus', name: 'Tablespoon (US, legal 15 mL)',sym: 'tbsp (US)',f: 0.015 },
        { id: 'tspus', name: 'Teaspoon (US, legal 5 mL)',   sym: 'tsp (US)', f: 0.005 },
        { id: 'tbsusc',name: 'Tablespoon (US, customary)',  sym: 'tbsp (US cust)', f: 0.01478676478125 },
        { id: 'tspusc',name: 'Teaspoon (US, customary)',    sym: 'tsp (US cust)',  f: 0.00492892159375 }
      ],
      def: 'l'
    },
    area: {
      units: [
        { id: 'mm2', name: 'Square Millimeter', sym: 'mm²',  f: 1e-6 },
        { id: 'cm2', name: 'Square Centimeter', sym: 'cm²',  f: 1e-4 },
        { id: 'm2',  name: 'Square Meter',      sym: 'm²',   f: 1 },
        { id: 'km2', name: 'Square Kilometer',  sym: 'km²',  f: 1e6 },
        { id: 'ha',  name: 'Hectare',           sym: 'ha',   f: 10000 },
        { id: 'acre',name: 'Acre',              sym: 'acre', f: 4046.8564224 },
        { id: 'in2', name: 'Square Inch',       sym: 'in²',  f: 0.00064516 },
        { id: 'ft2', name: 'Square Foot',       sym: 'ft²',  f: 0.09290304 },
        { id: 'yd2', name: 'Square Yard',       sym: 'yd²',  f: 0.83612736 },
        { id: 'mi2', name: 'Square Mile',       sym: 'mi²',  f: 2589988.110336 }
      ],
      def: 'm2'
    },
    speed: {
      units: [
        { id: 'ms',  name: 'Meter per Second',   sym: 'm/s',  f: 1 },
        { id: 'kmh', name: 'Kilometer per Hour', sym: 'km/h', f: 1 / 3.6 },
        { id: 'mph', name: 'Mile per Hour',      sym: 'mph',  f: 0.44704 },
        { id: 'fts', name: 'Foot per Second',    sym: 'ft/s', f: 0.3048 },
        { id: 'kn',  name: 'Knot',               sym: 'kn',   f: 1852 / 3600 },
        { id: 'mach',name: 'Mach (sea level)',   sym: 'Mach', f: 340.3 }
      ],
      def: 'ms'
    }
  };

  /* ---------- Data storage: decimal vs binary ---------- */
  var DATA_DECIMAL = [
    { id: 'bit', name: 'Bit',  sym: 'bit', f: 0.125 },
    { id: 'B',   name: 'Byte', sym: 'B',   f: 1 },
    { id: 'KB',  name: 'Kilobyte',     sym: 'KB',  f: 1e3 },
    { id: 'MB',  name: 'Megabyte',     sym: 'MB',  f: 1e6 },
    { id: 'GB',  name: 'Gigabyte',     sym: 'GB',  f: 1e9 },
    { id: 'TB',  name: 'Terabyte',     sym: 'TB',  f: 1e12 },
    { id: 'PB',  name: 'Petabyte',     sym: 'PB',  f: 1e15 }
  ];
  var DATA_BINARY = [
    { id: 'bit', name: 'Bit',  sym: 'bit', f: 0.125 },
    { id: 'B',   name: 'Byte', sym: 'B',   f: 1 },
    { id: 'KiB', name: 'Kibibyte', sym: 'KiB', f: 1024 },
    { id: 'MiB', name: 'Mebibyte', sym: 'MiB', f: 1024 * 1024 },
    { id: 'GiB', name: 'Gibibyte', sym: 'GiB', f: 1024 * 1024 * 1024 },
    { id: 'TiB', name: 'Tebibyte', sym: 'TiB', f: 1099511627776 },
    { id: 'PiB', name: 'Pebibyte', sym: 'PiB', f: 1125899906842624 }
  ];

  /* ---------- Temperature (non-linear) ---------- */
  var TEMP_UNITS = [
    { id: 'C', name: 'Celsius',    sym: '°C' },
    { id: 'F', name: 'Fahrenheit', sym: '°F' },
    { id: 'K', name: 'Kelvin',     sym: 'K'  },
    { id: 'R', name: 'Rankine',    sym: '°R' }
  ];
  function tempToK(v, from) {
    if (from === 'C') return v + 273.15;
    if (from === 'F') return (v - 32) * 5 / 9 + 273.15;
    if (from === 'K') return v;
    if (from === 'R') return v * 5 / 9;
    return v;
  }
  function tempFromK(k, to) {
    if (to === 'C') return k - 273.15;
    if (to === 'F') return (k - 273.15) * 9 / 5 + 32;
    if (to === 'K') return k;
    if (to === 'R') return k * 9 / 5;
    return k;
  }

  /* ---------- Render a unit-converter UI ---------- */
  function buildUnitUI(root, cfg) {
    var units = cfg.units;
    /* prefix lets one page host several unit converters without clashing ids */
    var p = cfg.prefix || '';
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="io-grid">' +
        '<div class="field"><label for="' + p + 'uv">Value</label>' +
          '<input type="text" id="' + p + 'uv" inputmode="decimal" value="' + (cfg.defaultValue || 1) + '" autocomplete="off"></div>' +
        '<div class="field"><label for="' + p + 'uf">From unit</label>' +
          '<select id="' + p + 'uf">' + units.map(function (u) {
            return '<option value="' + u.id + '"' + (u.id === cfg.def ? ' selected' : '') + '>' +
                   u.name + ' (' + u.sym + ')</option>';
          }).join('') + '</select></div>' +
      '</div>' +
      '<div class="result-box"><div class="result-main" id="' + p + 'rmain">—</div>' +
        '<div class="result-note" id="' + p + 'rnote"></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Unit</th><th>Value</th></tr></thead><tbody id="' + p + 'rtbody"></tbody></table></div>' +
      '<button class="btn btn-ghost btn-sm copy-btn" data-copy-target="#' + p + 'rmain">Copy result</button>';
    root.appendChild(wrap);

    var input = wrap.querySelector('#' + p + 'uv');
    var sel   = wrap.querySelector('#' + p + 'uf');
    var main  = wrap.querySelector('#' + p + 'rmain');
    var note  = wrap.querySelector('#' + p + 'rnote');
    var tbody = wrap.querySelector('#' + p + 'rtbody');

    function render() {
      var raw = input.value.trim().replace(/,/g, '');
      var v = parseNum(raw);
      if (raw === '' || isNaN(v)) {
        main.textContent = '—';
        note.textContent = 'Enter a number to see the conversion.';
        tbody.innerHTML = '';
        return;
      }
      var from = units.filter(function (u) { return u.id === sel.value; })[0] || units[0];
      var base = v * from.f;
      tbody.innerHTML = units.map(function (u) {
        var val = base / u.f;
        var isFrom = u.id === from.id;
        return '<tr' + (isFrom ? ' style="background:var(--primary-soft)"' : '') + '>' +
               '<td>' + u.name + ' <span style="color:var(--muted)">(' + u.sym + ')</span></td>' +
               '<td class="val">' + group(fmt(val)) + '</td></tr>';
      }).join('');
      var target = cfg.mainUnit ? getU(cfg.mainUnit, units) : units[0];
      main.innerHTML = group(fmt(v)) + ' <span class="unit">' + from.sym + '</span> = ' +
                       '<span style="color:var(--primary)">' +
                       group(fmt(base / target.f)) + ' ' + target.sym +
                       '</span>';
      if (cfg.extraNote) note.innerHTML = cfg.extraNote(v, from, base);
      else note.textContent = 'Showing all supported units for ' + group(fmt(v)) + ' ' + from.sym + '.';
    }
    function getF(id, us) {
      var u = us.filter(function (x) { return x.id === id; })[0];
      return u ? u.f : 1;
    }
    function getU(id, us) {
      return us.filter(function (x) { return x.id === id; })[0] || us[0];
    }
    input.addEventListener('input', render);
    sel.addEventListener('change', render);
    render();
  }

  /* ---------- Temperature UI ---------- */
  function buildTempUI(root) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="io-grid">' +
        '<div class="field"><label for="tv">Value</label>' +
          '<input type="text" id="tv" inputmode="decimal" value="0" autocomplete="off"></div>' +
        '<div class="field"><label for="tf">From scale</label>' +
          '<select id="tf">' + TEMP_UNITS.map(function (u) {
            return '<option value="' + u.id + '">' + u.name + ' (' + u.sym + ')</option>';
          }).join('') + '</select></div>' +
      '</div>' +
      '<div class="result-box"><div class="result-main" id="tmain">—</div>' +
        '<div class="result-note" id="tnote"></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Scale</th><th>Value</th></tr></thead>' +
        '<tbody id="ttbody"></tbody></table></div>' +
      '<button class="btn btn-ghost btn-sm copy-btn" data-copy-target="#tmain">Copy result</button>';
    root.appendChild(wrap);

    var input = wrap.querySelector('#tv');
    var sel   = wrap.querySelector('#tf');
    var main  = wrap.querySelector('#tmain');
    var note  = wrap.querySelector('#tnote');
    var tb    = wrap.querySelector('#ttbody');

    function render() {
      var raw = input.value.trim().replace(/,/g, '');
      var v = parseNum(raw);
      if (raw === '' || isNaN(v)) {
        main.textContent = '—'; tb.innerHTML = ''; return;
      }
      var k = tempToK(v, sel.value);
      tb.innerHTML = TEMP_UNITS.map(function (u) {
        return '<tr><td>' + u.name + ' <span style="color:var(--muted)">(' + u.sym + ')</span></td>' +
               '<td class="val">' + group(fmt(tempFromK(k, u.id))) + '</td></tr>';
      }).join('');
      var f = tempFromK(k, 'F'), c = tempFromK(k, 'C');
      main.innerHTML = group(fmt(v)) + ' <span class="unit">' + sel.value + '</span> = ' +
                       '<span style="color:var(--primary)">' + group(fmt(f)) + ' °F</span>';
      var ke = tempFromK(k, 'K');
      note.innerHTML = 'Equals <strong>' + group(fmt(c)) + ' °C</strong> · ' +
                       group(fmt(ke)) + ' K' +
                       (ke < 0 ? ' · <span style="color:var(--warn)">below absolute zero</span>' : '');
    }
    input.addEventListener('input', render);
    sel.addEventListener('change', render);
    render();
  }

  /* ---------- Data storage UI ---------- */
  function buildDataUI(root) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="io-grid">' +
        '<div class="field"><label for="dv">Value</label>' +
          '<input type="text" id="dv" inputmode="decimal" value="1" autocomplete="off"></div>' +
        '<div class="field"><label for="df">From unit</label><select id="df"></select></div>' +
        '<div class="field"><label for="dm">Standard</label>' +
          '<select id="dm">' +
            '<option value="dec">Decimal (SI / disk makers) — 1 kB = 1000 B</option>' +
            '<option value="bin" selected>Binary (IEC / Windows) — 1 KiB = 1024 B</option>' +
          '</select>' +
          '<div class="hint">Drives are sold in decimal; Windows reports binary. That gap is why a "1 TB" disk shows 931 GB.</div>' +
        '</div>' +
      '</div>' +
      '<div class="result-box"><div class="result-main" id="dmain">—</div>' +
        '<div class="result-note" id="dnote"></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Unit</th><th>Value</th></tr></thead>' +
        '<tbody id="dtbody"></tbody></table></div>' +
      '<button class="btn btn-ghost btn-sm copy-btn" data-copy-target="#dmain">Copy result</button>';
    root.appendChild(wrap);

    var input = wrap.querySelector('#dv');
    var sel   = wrap.querySelector('#df');
    var mode  = wrap.querySelector('#dm');
    var main  = wrap.querySelector('#dmain');
    var note  = wrap.querySelector('#dnote');
    var tb    = wrap.querySelector('#dtbody');

    function units() { return mode.value === 'dec' ? DATA_DECIMAL : DATA_BINARY; }
    function fillSelect(keep) {
      var us = units();
      sel.innerHTML = us.map(function (u) {
        return '<option value="' + u.id + '"' + (u.id === (keep || 'GiB') ? ' selected' : '') + '>' +
               u.name + ' (' + u.sym + ')</option>';
      }).join('');
      if (!us.filter(function (u) { return u.id === keep; })[0]) sel.value = 'B';
    }
    function render() {
      var raw = input.value.trim().replace(/,/g, '');
      var v = parseNum(raw);
      var us = units();
      if (raw === '' || isNaN(v)) { main.textContent = '—'; tb.innerHTML = ''; return; }
      var from = us.filter(function (u) { return u.id === sel.value; })[0] || us[1];
      var bytes = v * from.f;
      tb.innerHTML = us.map(function (u) {
        return '<tr><td>' + u.name + ' <span style="color:var(--muted)">(' + u.sym + ')</span></td>' +
               '<td class="val">' + group(fmt(bytes / u.f)) + '</td></tr>';
      }).join('');
      main.innerHTML = group(fmt(v)) + ' <span class="unit">' + from.sym + '</span> = ' +
                       '<span style="color:var(--primary)">' + group(bytes) + ' bytes</span>';
      note.innerHTML = 'Exactly <strong>' + group(bytes) + ' bytes</strong>. ' +
        (mode.value === 'bin'
          ? 'Binary (IEC) units — what Windows and most OS tools report.'
          : 'Decimal (SI) units — what storage manufacturers print on the box.');
    }
    mode.addEventListener('change', function () { fillSelect(sel.value); render(); });
    input.addEventListener('input', render);
    sel.addEventListener('change', render);
    fillSelect('GiB');
    render();
  }

  /* ---------- Fuel economy ---------- */
  function buildFuelUI(root) {
    var K_US = 235.214583, K_UK = 282.480936;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="io-grid">' +
        '<div class="field"><label for="fv">Value</label>' +
          '<input type="text" id="fv" inputmode="decimal" value="8" autocomplete="off"></div>' +
        '<div class="field"><label for="ff">From</label>' +
          '<select id="ff">' +
            '<option value="l100" selected>L / 100 km</option>' +
            '<option value="mpgus">MPG (US gallon)</option>' +
            '<option value="mpguk">MPG (UK / Imperial gallon)</option>' +
            '<option value="kml">km / L</option>' +
          '</select></div>' +
      '</div>' +
      '<div class="result-box"><div class="result-main" id="fmain">—</div>' +
        '<div class="result-note" id="fnote"></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Unit</th><th>Value</th></tr></thead>' +
        '<tbody id="ftbody"></tbody></table></div>' +
      '<div class="note-box"><strong>Why US and UK MPG differ by ~20%:</strong> ' +
        'a US gallon is 3.785 L, an Imperial gallon is 4.546 L. ' +
        'The same car scores a higher MPG number in the UK for identical fuel burn.</div>' +
      '<button class="btn btn-ghost btn-sm copy-btn" data-copy-target="#fmain">Copy result</button>';
    root.appendChild(wrap);

    var input = wrap.querySelector('#fv');
    var sel   = wrap.querySelector('#ff');
    var main  = wrap.querySelector('#fmain');
    var note  = wrap.querySelector('#fnote');
    var tb    = wrap.querySelector('#ftbody');

    function render() {
      var raw = input.value.trim().replace(/,/g, '');
      var v = parseNum(raw);
      if (raw === '' || isNaN(v) || v <= 0) {
        main.textContent = '—'; tb.innerHTML = '';
        note.textContent = 'Enter a value greater than zero.';
        return;
      }
      var l100;
      if (sel.value === 'l100')      l100 = v;
      else if (sel.value === 'mpgus')l100 = K_US / v;
      else if (sel.value === 'mpguk')l100 = K_UK / v;
      else                           l100 = 100 / v;

      var mpgus = K_US / l100, mpguk = K_UK / l100, kml = 100 / l100;
      var rows = [
        ['L / 100 km', fmt(l100)],
        ['MPG (US gallon)', fmt(mpgus)],
        ['MPG (UK / Imperial)', fmt(mpguk)],
        ['km / L', fmt(kml)]
      ];
      tb.innerHTML = rows.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td class="val">' + group(r[1]) + '</td></tr>';
      }).join('');
      main.innerHTML = group(fmt(v)) + ' <span class="unit">' +
        (sel.value === 'l100' ? 'L/100km' : sel.value === 'kml' ? 'km/L' :
         sel.value === 'mpgus' ? 'MPG (US)' : 'MPG (UK)') + '</span> = ' +
        '<span style="color:var(--primary)">' + group(fmt(l100)) + ' L/100km</span>';
      note.innerHTML = 'Lower L/100 km means better economy. ' +
        'This car uses <strong>' + fmt(l100) + ' L per 100 km</strong>, ' +
        'or <strong>' + fmt(mpgus) + ' MPG (US)</strong>.';
    }
    input.addEventListener('input', render);
    sel.addEventListener('change', render);
    render();
  }

  /* ---------- Shoe size (lookup table) ---------- */
  var SHOE_MEN = [
    [6, 5.5, 38.5, 24.0, 38.5], [6.5, 6, 39, 24.5, 39],
    [7, 6.5, 40, 25.0, 40],     [7.5, 7, 40.5, 25.5, 40.5],
    [8, 7.5, 41, 26.0, 41],     [8.5, 8, 42, 26.5, 42],
    [9, 8.5, 42.5, 27.0, 42.5], [9.5, 9, 43, 27.5, 43],
    [10, 9.5, 44, 28.0, 44],    [10.5, 10, 44.5, 28.5, 44.5],
    [11, 10.5, 45, 29.0, 45],   [11.5, 11, 45.5, 29.5, 45.5],
    [12, 11.5, 46, 30.0, 46],   [13, 12.5, 47.5, 31.0, 47.5],
    [14, 13.5, 48.5, 32.0, 48.5]
  ];
  function buildShoeUI(root) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="io-grid">' +
        '<div class="field"><label for="sv">Size</label>' +
          '<input type="text" id="sv" inputmode="decimal" value="9" autocomplete="off"></div>' +
        '<div class="field"><label for="sf">System</label>' +
          '<select id="sf">' +
            '<option value="0" selected>US (Men)</option>' +
            '<option value="0w">US (Women)</option>' +
            '<option value="1">UK</option>' +
            '<option value="2">EU</option>' +
            '<option value="3">Japan (cm)</option>' +
            '<option value="4">China</option>' +
          '</select></div>' +
      '</div>' +
      '<div class="result-box"><div class="result-main" id="smain">—</div>' +
        '<div class="result-note" id="snote"></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>US M</th><th>US W</th><th>UK</th><th>EU</th><th>JP cm</th><th>CN</th>' +
        '</tr></thead><tbody id="stbody"></tbody></table></div>' +
      '<div class="note-box warn"><strong>Shoe sizing is not a formula — it is a lookup table.</strong> ' +
        'Each brand applies its own last and tolerances, so treat conversions as a starting point, ' +
        'not a guarantee. Width fittings (D, E, 2E) are not covered.</div>' +
      '<button class="btn btn-ghost btn-sm copy-btn" data-copy-target="#smain">Copy result</button>';
    root.appendChild(wrap);

    var input = wrap.querySelector('#sv');
    var sel   = wrap.querySelector('#sf');
    var main  = wrap.querySelector('#smain');
    var note  = wrap.querySelector('#snote');
    var tb    = wrap.querySelector('#stbody');

    tb.innerHTML = SHOE_MEN.map(function (r) {
      return '<tr><td class="val">' + r[0] + '</td><td>' + (r[0] + 1.5) + '</td><td>' + r[1] +
             '</td><td>' + r[2] + '</td><td>' + r[3].toFixed(1) + '</td><td>' + r[4] + '</td></tr>';
    }).join('');

    function render() {
      var raw = input.value.trim();
      var v = parseNum(raw);
      if (raw === '' || isNaN(v)) { main.textContent = '—'; return; }
      var key = sel.value;
      var col = key === '0w' ? 0 : parseInt(key, 10);
      var target = key === '0w' ? v - 1.5 : v;   // women's US = men's US - 1.5
      // find nearest row by that column
      var best = null, bestD = Infinity;
      SHOE_MEN.forEach(function (r) {
        var d = Math.abs(r[col] - target);
        if (d < bestD) { bestD = d; best = r; }
      });
      if (!best) { main.textContent = '—'; return; }
      var label = key === '0w' ? 'US W' : ['US M', 'UK', 'EU', 'JP', 'CN'][col];
      main.innerHTML = label + ' <span class="unit">' + v + '</span> ≈ ' +
        '<span style="color:var(--primary)">EU ' + best[2] + ' / UK ' + best[1] + '</span>';
      note.innerHTML = 'Closest match: US Men <strong>' + best[0] + '</strong>, US Women <strong>' +
        (best[0] + 1.5) + '</strong>, UK <strong>' + best[1] + '</strong>, EU <strong>' + best[2] +
        '</strong>, Japan <strong>' + best[3].toFixed(1) + ' cm</strong>, China <strong>' + best[4] +
        '</strong>.';
    }
    input.addEventListener('input', render);
    sel.addEventListener('change', render);
    render();
  }

  /* ---------- Cooking (volume + ingredient density) ---------- */
  var INGREDIENTS = [
    ['Water', 1.0], ['Milk', 1.03], ['All-purpose flour', 0.53],
    ['Granulated sugar', 0.85], ['Brown sugar (packed)', 0.93],
    ['Butter', 0.911], ['Honey', 1.42], ['Table salt', 1.2],
    ['Vegetable oil', 0.92], ['Rolled oats', 0.35], ['Cocoa powder', 0.42]
  ];
  var CUP_VOLUMES = [
    /* Two self-consistent US sets are offered because mixing them is a classic
       source of error: legal (240 / 15 / 5) and customary (236.588 / 14.787 / 4.929).
       Each set satisfies 1 cup = 16 tbsp = 48 tsp on its own. */
    { id: 'cupus', name: 'Cup (US, legal)', ml: 240 },
    { id: 'cupusc', name: 'Cup (US, customary)', ml: 236.5882365 },
    { id: 'cupjp', name: 'Cup (Japan, 200 mL)', ml: 200 },
    { id: 'cupau', name: 'Cup (Australia)', ml: 250 },
    { id: 'cupuk', name: 'Cup (UK, metric)', ml: 250 },
    { id: 'tbsus', name: 'Tablespoon (US, legal)', ml: 15 },
    { id: 'tbsusc', name: 'Tablespoon (US, customary)', ml: 14.786765 },
    { id: 'tbsau', name: 'Tablespoon (Australia)', ml: 20 },
    { id: 'tspus', name: 'Teaspoon (US, legal)', ml: 5 },
    { id: 'tspusc', name: 'Teaspoon (US, customary)', ml: 4.928922 },
    { id: 'tspau', name: 'Teaspoon (Australia)', ml: 5 },
    { id: 'ml',    name: 'Milliliter', ml: 1 },
    { id: 'flozus',name: 'Fluid ounce (US)', ml: 29.573530 },
    { id: 'flozuk',name: 'Fluid ounce (UK)', ml: 28.413063 }
  ];
  function buildCookingUI(root) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="io-grid">' +
        '<div class="field"><label for="cv">Amount</label>' +
          '<input type="text" id="cv" inputmode="decimal" value="1" autocomplete="off"></div>' +
        '<div class="field"><label for="cf">Unit</label>' +
          '<select id="cf">' + CUP_VOLUMES.map(function (u) {
            return '<option value="' + u.id + '"' + (u.id === 'cupus' ? ' selected' : '') + '>' +
                   u.name + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label for="ci">Ingredient</label>' +
          '<select id="ci">' + INGREDIENTS.map(function (g, i) {
            return '<option value="' + i + '"' + (i === 2 ? ' selected' : '') + '>' + g[0] + '</option>';
          }).join('') + '</select></div>' +
      '</div>' +
      '<div class="result-box"><div class="result-main" id="cmain">—</div>' +
        '<div class="result-note" id="cnote"></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Unit</th><th>Volume</th><th>Weight (' + '</th></tr></thead>' +
        '<tbody id="ctbody"></tbody></table></div>' +
      '<div class="note-box"><strong>A "cup" is not one size.</strong> ' +
        'US legal cup = 240 mL, Japanese cup = 200 mL, Australian cup = 250 mL. ' +
        'A recipe written in one country can be off by 20% if you use another country’s cup.</div>' +
      '<button class="btn btn-ghost btn-sm copy-btn" data-copy-target="#cmain">Copy result</button>';
    root.appendChild(wrap);

    var input = wrap.querySelector('#cv');
    var selU  = wrap.querySelector('#cf');
    var selI  = wrap.querySelector('#ci');
    var main  = wrap.querySelector('#cmain');
    var note  = wrap.querySelector('#cnote');
    var tb    = wrap.querySelector('#ctbody');
    var thd   = wrap.querySelector('thead tr');

    function render() {
      var raw = input.value.trim().replace(/,/g, '');
      var v = parseNum(raw);
      var ing = INGREDIENTS[parseInt(selI.value, 10) || 0];
      thd.innerHTML = '<th>Unit</th><th>Volume</th><th>Weight (' + ing[0] + ')</th>';
      if (raw === '' || isNaN(v)) { main.textContent = '—'; tb.innerHTML = ''; return; }
      var unit = CUP_VOLUMES.filter(function (u) { return u.id === selU.value; })[0];
      var ml = v * unit.ml;
      tb.innerHTML = CUP_VOLUMES.map(function (u) {
        var vol = ml / u.ml;
        return '<tr><td>' + u.name + '</td><td class="val">' + fmt(vol) + '</td>' +
               '<td>' + fmt(ml * ing[1]) + ' g</td></tr>';
      }).join('');
      main.innerHTML = group(fmt(v)) + ' <span class="unit">' + unit.name + '</span> = ' +
        '<span style="color:var(--primary)">' + fmt(ml) + ' mL</span>';
      note.innerHTML = 'That is <strong>' + fmt(ml) + ' mL</strong>, which weighs about ' +
        '<strong>' + fmt(ml * ing[1]) + ' g</strong> of ' + ing[0].toLowerCase() + '.';
    }
    input.addEventListener('input', render);
    selU.addEventListener('change', render);
    selI.addEventListener('change', render);
    render();
  }

  /* ============================================================
     Percentage calculator — 3 modes
     ============================================================ */
  function initPercentage(root) {
    var mode = root.querySelector('#pMode');
    var a = root.querySelector('#pA');
    var b = root.querySelector('#pB');
    var out = root.querySelector('#pOut');
    var lblA = root.querySelector('#pLblA');
    var lblB = root.querySelector('#pLblB');
    var LABELS = {
      pct: ['What is X% of Y?', 'X (%)', 'Y'],
      iswhat: ['X is what % of Y?', 'X', 'Y'],
      change: ['Percentage change from X to Y', 'X (original)', 'Y (new)']
    };
    function render() {
      var m = mode.value;
      lblA.textContent = LABELS[m][1];
      lblB.textContent = LABELS[m][2];
      var x = parseNum(a.value), y = parseNum(b.value);
      if (isNaN(x) || isNaN(y)) { out.textContent = '—'; return; }
      var r;
      if (m === 'pct') {
        r = x / 100 * y;
        out.textContent = fmt(r);
      } else if (m === 'iswhat') {
        if (y === 0) { out.textContent = 'undefined (Y is 0)'; return; }
        r = x / y * 100;
        out.textContent = fmt(r) + '%';
      } else {
        if (x === 0) { out.textContent = 'undefined (X is 0)'; return; }
        r = (y - x) / x * 100;
        out.textContent = (r >= 0 ? '+' : '') + fmt(r) + '%';
      }
    }
    [mode, a, b].forEach(function (el) {
      el.addEventListener('input', render); el.addEventListener('change', render);
    });
    render();
  }

  /* ============================================================
     Average / median / std dev
     ============================================================ */
  function initAverage(root) {
    var ta = root.querySelector('#avgInput');
    var out = root.querySelector('#avgOut');
    function render() {
      /* A comma is ambiguous: list separator ("2,4,4") OR thousands
         grouping ("1,000"). Rule: grouping only when it follows the
         x,NNN pattern (exactly 3 digits per group); otherwise split. */
      var nums = [];
      ta.value.split(/[\s;]+/).map(function (s) { return s.trim(); })
        .filter(function (s) { return s !== ''; })
        .forEach(function (chunk) {
          var parts = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(chunk)
            ? [chunk.replace(/,/g, '')]          /* thousands grouping */
            : chunk.split(',');                   /* list separator */
          parts.forEach(function (p) {
            var n = parseNum(p);
            if (Number.isFinite(n)) nums.push(n);
          });
        });
      if (!nums.length) { out.innerHTML = '<p style="color:var(--muted)">Enter numbers to see statistics.</p>'; return; }
      var n = nums.length;
      var sum = nums.reduce(function (s, x) { return s + x; }, 0);
      var mean = sum / n;
      var sorted = nums.slice().sort(function (p, q) { return p - q; });
      var median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      var variance = nums.reduce(function (s, x) { return s + Math.pow(x - mean, 2); }, 0) / (n > 1 ? n - 1 : 1);
      var sd = Math.sqrt(variance);
      var counts = {};
      nums.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
      var modeArr = Object.keys(counts).filter(function (k) {
        return counts[k] === Math.max.apply(null, Object.keys(counts).map(function (j) { return counts[j]; }));
      });
      var modeTxt = Object.keys(counts).length === nums.length ? 'none (all unique)' : modeArr.join(', ');
      out.innerHTML =
        '<table class="data"><tbody>' +
        '<tr><td>Count</td><td class="val">' + n + '</td></tr>' +
        '<tr><td>Sum</td><td class="val">' + fmt(sum) + '</td></tr>' +
        '<tr><td>Mean (average)</td><td class="val">' + fmt(mean) + '</td></tr>' +
        '<tr><td>Median</td><td class="val">' + fmt(median) + '</td></tr>' +
        '<tr><td>Mode</td><td class="val">' + modeTxt + '</td></tr>' +
        '<tr><td>Min / Max</td><td class="val">' + fmt(sorted[0]) + ' / ' + fmt(sorted[n - 1]) + '</td></tr>' +
        '<tr><td>Range</td><td class="val">' + fmt(sorted[n - 1] - sorted[0]) + '</td></tr>' +
        '<tr><td>Std deviation (sample)</td><td class="val">' + fmt(sd) + '</td></tr>' +
        '</tbody></table>' +
        '<p style="margin-top:12px;font-size:.86rem;color:var(--muted)">' +
        'Sample standard deviation uses n−1 (Bessel’s correction), which is what most ' +
        'statistics courses and spreadsheet STDEV functions use.</p>';
    }
    ta.addEventListener('input', render);
    render();
  }

  /* ============================================================
     GCD & LCM
     ============================================================ */
  function initGcd(root) {
    var ta = root.querySelector('#gcdInput');
    var out = root.querySelector('#gcdOut');
    function gcd2(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
    function render() {
      /* Split on separators, validate each token strictly. Zero is allowed:
         gcd(0,n)=|n| and lcm(0,n)=0 by definition. */
      var nums = ta.value.split(/[\s,;]+/).map(function (s) { return s.trim(); })
                   .filter(function (s) { return s !== ''; })
                   .map(function (s) { return parseNum(s); });
      if (nums.some(function (n) { return !Number.isFinite(n) || Math.floor(n) !== n; })) {
        out.innerHTML = '<p style="color:var(--err)">Enter whole numbers only (e.g. 12, 18, 0).</p>';
        return;
      }
      nums = nums.map(function (n) { return Math.abs(n); });
      if (nums.length < 2) { out.innerHTML = '<p style="color:var(--muted)">Enter at least two whole numbers.</p>'; return; }
      if (nums.some(function (n) { return !Number.isSafeInteger(n); })) {
        out.innerHTML = '<p style="color:var(--err)">Numbers too large — result would lose precision.</p>';
        return;
      }
      var g = nums.reduce(function (acc, x) { return gcd2(acc, x); });
      /* LCM via BigInt. gcd must also run in BigInt — Number(acc) on a
         huge BigInt loses precision and can yield gcd 0 → division by zero. */
      function gcdBig(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { var t = b; b = a % b; a = t; } return a; }
      var lcmBig = nums.reduce(function (acc, x) {
        var d = gcdBig(acc, BigInt(x));
        return d === 0n ? 0n : (acc / d) * BigInt(x);
      }, BigInt(nums[0]));
      var lcmSafe = lcmBig <= BigInt(Number.MAX_SAFE_INTEGER);
      out.innerHTML =
        '<div class="result-main">' + g + '</div><div class="result-note">GCD (greatest common divisor)</div>' +
        '<div class="result-main" style="margin-top:18px">' +
          (lcmSafe ? lcmBig.toString() : lcmBig.toString() + ' <span style="font-size:.6em;color:var(--muted)">(exact, exceeds safe integer)</span>') +
        '</div>' +
        '<div class="result-note">LCM (least common multiple)</div>';
    }
    ta.addEventListener('input', render);
    render();
  }

  /* ============================================================
     Fraction calculator
     ============================================================ */
  function initFraction(root) {
    var n1 = root.querySelector('#fN1'), d1 = root.querySelector('#fD1');
    var n2 = root.querySelector('#fN2'), d2 = root.querySelector('#fD2');
    var op = root.querySelector('#fOp');
    var out = root.querySelector('#fOut');
    function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
    function reduce(n, d) {
      if (d === 0) return null;
      if (d < 0) { n = -n; d = -d; }
      var g = gcd(n, d) || 1;
      return [n / g, d / g];
    }
    function render() {
      var a = parseInt(n1.value, 10), b = parseInt(d1.value, 10);
      var c = parseInt(n2.value, 10), e = parseInt(d2.value, 10);
      if ([a, b, c, e].some(isNaN) || b === 0 || e === 0) {
        out.innerHTML = '<p style="color:var(--muted)">Enter valid fractions (denominators cannot be 0).</p>'; return;
      }
      var rn, rd;
      if (op.value === '+')      { rn = a * e + c * b; rd = b * e; }
      else if (op.value === '-') { rn = a * e - c * b; rd = b * e; }
      else if (op.value === '*') { rn = a * c;         rd = b * e; }
      else                       { rn = a * e;         rd = b * c; }
      var r = reduce(rn, rd);
      if (!r) { out.innerHTML = '<p style="color:var(--err)">Result denominator is zero.</p>'; return; }
      var dec = rn / rd;
      var whole = r[1] === 1 ? String(r[0]) : (Math.abs(r[0]) > r[1]
        ? (Math.trunc(r[0] / r[1]) + ' ' + Math.abs(r[0]) % r[1] + '/' + r[1]) : r[0] + '/' + r[1]);
      out.innerHTML =
        '<div class="result-main">' + whole + '</div>' +
        '<div class="result-note">Simplified result</div>' +
        '<table class="data" style="margin-top:16px"><tbody>' +
        '<tr><td>Unsimplified</td><td class="val">' + rn + '/' + rd + '</td></tr>' +
        '<tr><td>Decimal</td><td class="val">' + fmt(dec) + '</td></tr>' +
        '</tbody></table>';
    }
    [n1, d1, n2, d2, op].forEach(function (el) {
      el.addEventListener('input', render); el.addEventListener('change', render);
    });
    render();
  }

  /* ============================================================
     Date duration
     ============================================================ */
  function initDateDuration(root) {
    var s = root.querySelector('#ddStart'), e = root.querySelector('#ddEnd');
    var out = root.querySelector('#ddOut');
    function render() {
      var d1 = new Date(s.value + 'T00:00:00'), d2 = new Date(e.value + 'T00:00:00');
      if (!s.value || !e.value || isNaN(d1) || isNaN(d2)) {
        out.innerHTML = '<p style="color:var(--muted)">Pick both dates.</p>'; return;
      }
      var ms = d2 - d1;
      var days = Math.round(ms / 86400000);
      var neg = days < 0;
      var ad = Math.abs(days);
      var years = Math.floor(ad / 365.2425);
      var rem = ad - Math.floor(years * 365.2425);
      var weeks = Math.floor(ad / 7);
      out.innerHTML =
        '<div class="result-main">' + (neg ? '−' : '') + ad.toLocaleString('en-US') + ' days</div>' +
        '<div class="result-note">' + (neg ? 'End date is before start date' : 'Total duration') + '</div>' +
        '<table class="data" style="margin-top:16px"><tbody>' +
        '<tr><td>Calendar days</td><td class="val">' + ad.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Weeks</td><td class="val">' + fmt(ad / 7) + '</td></tr>' +
        '<tr><td>Years (365.2425 d)</td><td class="val">' + fmt(ad / 365.2425) + '</td></tr>' +
        '<tr><td>Approx. years + days</td><td class="val">' + years + ' y ' + Math.floor(rem) + ' d</td></tr>' +
        '<tr><td>Hours</td><td class="val">' + (ad * 24).toLocaleString('en-US') + '</td></tr>' +
        '</tbody></table>';
    }
    [s, e].forEach(function (el) { el.addEventListener('change', render); });
    var t = new Date(), later = new Date(t.getTime() + 30 * 86400000);
    s.value = t.toISOString().slice(0, 10);
    e.value = later.toISOString().slice(0, 10);
    render();
  }

  /* ============================================================
     Age calculator
     ============================================================ */
  function initAge(root) {
    var bIn = root.querySelector('#ageBirth'), asOf = root.querySelector('#ageAsOf');
    var out = root.querySelector('#ageOut');
    function render() {
      var bd = new Date(bIn.value + 'T00:00:00');
      var ref = asOf.value ? new Date(asOf.value + 'T00:00:00') : new Date();
      if (!bIn.value || isNaN(bd)) { out.innerHTML = '<p style="color:var(--muted)">Pick a birth date.</p>'; return; }
      if (bd > ref) { out.innerHTML = '<p style="color:var(--err)">Birth date is in the future.</p>'; return; }
      var y = ref.getFullYear() - bd.getFullYear();
      var m = ref.getMonth() - bd.getMonth();
      var d = ref.getDate() - bd.getDate();
      if (d < 0) {
        m--;
        var prevMonth = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
        d += prevMonth;
      }
      if (m < 0) { y--; m += 12; }
      var totalDays = Math.floor((ref - bd) / 86400000);
      // next birthday
      var nb = new Date(ref.getFullYear(), bd.getMonth(), bd.getDate());
      if (nb < ref) nb = new Date(ref.getFullYear() + 1, bd.getMonth(), bd.getDate());
      var daysTo = Math.round((nb - ref) / 86400000);
      out.innerHTML =
        '<div class="result-main">' + y + ' years, ' + m + ' months, ' + d + ' days</div>' +
        '<div class="result-note">Exact age</div>' +
        '<table class="data" style="margin-top:16px"><tbody>' +
        '<tr><td>Total days lived</td><td class="val">' + totalDays.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Total weeks</td><td class="val">' + Math.floor(totalDays / 7).toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Total months</td><td class="val">' + (y * 12 + m) + '</td></tr>' +
        '<tr><td>Total hours (approx.)</td><td class="val">' + (totalDays * 24).toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Next birthday</td><td class="val">' + nb.toDateString() + ' (in ' + daysTo + ' days)</td></tr>' +
        '</tbody></table>';
    }
    [bIn, asOf].forEach(function (el) { el.addEventListener('change', render); });
    render();
  }

  /* ============================================================
     Unix timestamp
     ============================================================ */
  function initTimestamp(root) {
    var ts = root.querySelector('#tsInput');
    var dt = root.querySelector('#tsDate');
    var out = root.querySelector('#tsOut');
    var nowBtn = root.querySelector('#tsNow');
    function render() {
      var t = ts.value.trim();
      var d;
      if (t === '') { out.innerHTML = '<p style="color:var(--muted)">Enter a timestamp to convert.</p>'; return; }
      var n = Number(t);
      if (!isFinite(n)) { out.innerHTML = '<p style="color:var(--err)">Not a valid number.</p>'; return; }
      // seconds vs milliseconds heuristic
      if (Math.abs(n) < 1e11) d = new Date(n * 1000); else d = new Date(n);
      if (isNaN(d.getTime())) { out.innerHTML = '<p style="color:var(--err)">Out of range.</p>'; return; }
      out.innerHTML =
        '<div class="result-main">' + d.toUTCString() + '</div>' +
        '<div class="result-note">UTC · detected as ' + (Math.abs(n) < 1e11 ? 'seconds' : 'milliseconds') + '</div>' +
        '<table class="data" style="margin-top:16px"><tbody>' +
        '<tr><td>Unix (seconds)</td><td class="val">' + Math.floor(d.getTime() / 1000) + '</td></tr>' +
        '<tr><td>Unix (milliseconds)</td><td class="val">' + d.getTime() + '</td></tr>' +
        '<tr><td>ISO 8601</td><td class="val">' + d.toISOString() + '</td></tr>' +
        '<tr><td>Local</td><td class="val">' + d.toString() + '</td></tr>' +
        '</tbody></table>';
    }
    ts.addEventListener('input', render);
    nowBtn.addEventListener('click', function () {
      ts.value = Math.floor(Date.now() / 1000); render();
    });
    ts.value = Math.floor(Date.now() / 1000);
    render();
  }

  /* ============================================================
     Base64 (UTF-8 safe)
     ============================================================ */
  function initBase64(root) {
    var input = root.querySelector('#b64Input');
    var output = root.querySelector('#b64Output');
    var enc = root.querySelector('#b64Enc');
    var dec = root.querySelector('#b64Dec');
    var copy = root.querySelector('#b64Copy');
    var note = root.querySelector('#b64Note');
    function run(mode) {
      var v = input.value;
      if (!v) { output.value = ''; note.textContent = ''; return; }
      try {
        if (mode === 'enc') {
          var bin = utf8ToBinary(v);
          output.value = btoa(bin);
          note.textContent = 'Encoded ' + bin.length + ' bytes → ' + output.value.length + ' characters.';
        } else {
          var bin2 = atob(v.replace(/\s/g, ''));
          output.value = binaryToUtf8(bin2);
          note.textContent = 'Decoded ' + bin2.length + ' bytes.';
        }
      } catch (e) {
        output.value = '';
        note.innerHTML = '<span style="color:var(--err)">Failed: ' +
          (mode === 'dec' ? 'not valid Base64 (check for stray characters or missing padding).' : 'encoding error.') +
          '</span>';
      }
    }
    enc.addEventListener('click', function () { run('enc'); });
    dec.addEventListener('click', function () { run('dec'); });
    copy.addEventListener('click', function () {
      output.select();
      try { document.execCommand('copy'); copy.textContent = 'Copied ✓'; } catch (e) {}
      setTimeout(function () { copy.textContent = 'Copy output'; }, 1400);
    });
  }

  /* ============================================================
     URL encode / decode
     ============================================================ */
  function initUrl(root) {
    var input = root.querySelector('#urlInput');
    var output = root.querySelector('#urlOutput');
    var enc = root.querySelector('#urlEnc');
    var dec = root.querySelector('#urlDec');
    var copy = root.querySelector('#urlCopy');
    var note = root.querySelector('#urlNote');
    function run(mode) {
      var v = input.value;
      try {
        if (mode === 'enc') {
          output.value = encodeURIComponent(v);
          note.textContent = 'Use encodeURIComponent for query-string values, not whole URLs.';
        } else {
          output.value = decodeURIComponent(v.replace(/\+/g, ' '));
          note.textContent = '“+” was decoded as a space (form encoding convention).';
        }
      } catch (e) {
        output.value = '';
        note.innerHTML = '<span style="color:var(--err)">Failed: malformed escape sequence.</span>';
      }
    }
    enc.addEventListener('click', function () { run('enc'); });
    dec.addEventListener('click', function () { run('dec'); });
    copy.addEventListener('click', function () {
      output.select();
      try { document.execCommand('copy'); copy.textContent = 'Copied ✓'; } catch (e) {}
      setTimeout(function () { copy.textContent = 'Copy output'; }, 1400);
    });
  }

  /* ============================================================
     Word counter
     ============================================================ */
  function initWordCount(root) {
    var ta = root.querySelector('#wcInput');
    var out = root.querySelector('#wcOut');
    function render() {
      var v = ta.value;
      var chars = v.length;
      var charsNoSpace = v.replace(/\s/g, '').length;
      var words = v.trim() ? v.trim().split(/\s+/).length : 0;
      var lines = v ? v.split(/\r\n|\r|\n/).length : 0;
      var paras = v.trim() ? v.trim().split(/\n\s*\n/).length : 0;
      var bytes = utf8Bytes(v).length;
      var sentences = v.trim() ? (v.trim().split(/[.!?]+(?=\s|$)/).filter(function (s) { return s.trim(); }).length) : 0;
      var mins = words / 200;
      out.innerHTML =
        '<table class="data"><tbody>' +
        '<tr><td>Words</td><td class="val">' + words.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Characters (with spaces)</td><td class="val">' + chars.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Characters (no spaces)</td><td class="val">' + charsNoSpace.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Bytes (UTF-8)</td><td class="val">' + bytes.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Sentences</td><td class="val">' + sentences.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Lines</td><td class="val">' + lines.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Paragraphs</td><td class="val">' + paras.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td>Reading time (200 wpm)</td><td class="val">' + fmt(mins) + ' min</td></tr>' +
        '</tbody></table>';
    }
    ta.addEventListener('input', render);
    render();
  }

  /* ============================================================
     Dispatch
     ============================================================ */
  var BUILDERS = {
    'length-converter':        function (r) { buildUnitUI(r, { units: UNIT_DEFS.length.units, def: 'm' }); },
    'weight-converter':        function (r) { buildUnitUI(r, { units: UNIT_DEFS.weight.units, def: 'kg', mainUnit: 'lb' }); },
    'volume-converter':        function (r) { buildUnitUI(r, { units: UNIT_DEFS.volume.units, def: 'l' }); },
    'area-converter':          function (r) { buildUnitUI(r, { units: UNIT_DEFS.area.units, def: 'm2' }); },
    'speed-converter':         function (r) { buildUnitUI(r, { units: UNIT_DEFS.speed.units, def: 'ms' }); },
    'temperature-converter':   buildTempUI,
    'data-storage-converter':  buildDataUI,
    'fuel-economy-converter':  buildFuelUI,
    'shoe-size-converter':     buildShoeUI,
    'cooking-converter':       buildCookingUI,
    'percentage-calculator':   initPercentage,
    'average-calculator':      initAverage,
    'gcd-lcm-calculator':      initGcd,
    'fraction-calculator':     initFraction,
    'date-duration-calculator':initDateDuration,
    'age-calculator':          initAge,
    'unix-timestamp-converter':initTimestamp,
    'base64-tool':             initBase64,
    'url-encoder':             initUrl,
    'word-counter':            initWordCount
  };

  function boot() {
    /* every [data-tool] on the page — weight page hosts two converters */
    var mounts = document.querySelectorAll('[data-tool]');
    for (var i = 0; i < mounts.length; i++) {
      var mount = mounts[i];
      var fn = BUILDERS[mount.getAttribute('data-tool')];
      if (fn) {
        try { fn(mount); }
        catch (e) { mount.innerHTML = '<p style="color:var(--err)">Tool failed to load.</p>'; }
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
