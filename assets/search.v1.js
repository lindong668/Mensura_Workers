/* Plantorial on-site search (static, no backend).
   Loads the per-language article index built from the 65 guides, matches
   title / description / category / FAQ keywords, expands common colloquial
   synonyms, ranks by relevance, and shows a friendly empty state with
   category links when nothing matches. URLs and copy are untouched. */
(function () {
  'use strict';

  var form = document.querySelector('.pm-search-form');
  var input = document.getElementById('pm-search-input');
  var box = document.getElementById('pm-search-results');
  if (!form || !input || !box) return;

  var path = location.pathname;
  var lang = path.indexOf('/zh-tw/') === 0 ? 'zh-tw'
           : path.indexOf('/zh-cn/') === 0 ? 'zh-cn' : 'en';

  var STR = {
    en: {
      placeholder: 'Search problems or plants — yellow leaves, pests, watering…',
      button: 'Search',
      heading: 'Guides found',
      empty: 'No guide matches “{q}” yet. Try a shorter word, or browse the categories below.',
      cats: [
        ['/category/common-houseplants/', 'Common Houseplants'],
        ['/category/succulents-cacti/', 'Succulents & Cacti'],
        ['/category/flowering-plants/', 'Flowering Plants'],
        ['/category/pests-diseases/', 'Pests & Diseases'],
        ['/category/care-basics/', 'Care Basics'],
        ['/category/propagation-repotting/', 'Propagation & Repotting']
      ]
    },
    'zh-cn': {
      placeholder: '搜索问题或植物 —— 黄叶、发蔫、浇水、虫害…',
      button: '搜索',
      heading: '找到相关指南',
      empty: '暂时没有和「{q}」完全对应的指南。可以换个更短的词，或从下面的分类浏览。',
      cats: [
        ['/zh-cn/category/common-houseplants/', '常见观叶植物'],
        ['/zh-cn/category/succulents-cacti/', '多肉与仙人掌'],
        ['/zh-cn/category/flowering-plants/', '室内开花植物'],
        ['/zh-cn/category/pests-diseases/', '病虫害防治'],
        ['/zh-cn/category/care-basics/', '养护基础'],
        ['/zh-cn/category/propagation-repotting/', '繁殖与换盆']
      ]
    },
    'zh-tw': {
      placeholder: '搜尋問題或植物 —— 黃葉、發蔫、澆水、蟲害…',
      button: '搜尋',
      heading: '找到相關指南',
      empty: '暫時沒有和「{q}」完全對應的指南。可以換個更短的詞，或從下面的分類瀏覽。',
      cats: [
        ['/zh-tw/category/common-houseplants/', '常見觀葉植物'],
        ['/zh-tw/category/succulents-cacti/', '多肉與仙人掌'],
        ['/zh-tw/category/flowering-plants/', '室內開花植物'],
        ['/zh-tw/category/pests-diseases/', '病蟲害防治'],
        ['/zh-tw/category/care-basics/', '養護基礎'],
        ['/zh-tw/category/propagation-repotting/', '繁殖與換盆']
      ]
    }
  };

  var STOP = { en: {}, 'zh-cn': {}, 'zh-tw': {} };
  'the a an and of for to my is are how what why on in with plant plants indoor houseplant houseplants leave leaves does do you your me'.split(' ').forEach(function (w) { STOP.en[w] = 1; });

  // Colloquial variants -> canonical tokens already used in our titles/descriptions.
  var SYN = {
    en: [
      [['wilt', 'wilting', 'wilts', 'droopy', 'sagging', 'flop', 'droop'], ['droop']],
      [['yellowing', 'yellows', 'turned yellow'], ['yellow']],
      [['rootrot', 'rotting', 'roted', 'mushy roots'], ['root rot', 'rot']],
      [['mealybug', 'mealybugs', 'mealy bug', 'mealy bugs'], ['mealybug', 'mealybugs']],
      [['spidermite', 'spidermites', 'mites', 'mite'], ['spider mite', 'mites']],
      [['scaleinsect', 'scales'], ['scale']],
      [['aphid'], ['aphids']],
      [['gnat', 'gnats', 'fungusgnat', 'fruitfly', 'fruit flies', 'sciarid'], ['fungus gnats', 'gnats']],
      [['whitefly', 'whiteflies', 'white fly'], ['whiteflies', 'whitefly']],
      [['mould'], ['mold']],
      [['repot', 'repoting', 're-pot', 'potting up', 'transplant'], ['repot', 'repotting']],
      [['propagate', 'propagation', 'cutting', 'cuttings', 'clone', 'rooting'], ['propagation', 'cuttings']],
      [['water', 'watering', 'wither from dry'], ['watering', 'water']],
      [['misting', 'dry air', 'dryness'], ['humidity']],
      [['sunlight', 'sun', 'shade', 'shady', 'bright light'], ['light']],
      [['fertiliser', 'feed', 'feeding', 'plant food', 'nutrients'], ['fertilizer']],
      [['potting mix', 'substrate', 'compost'], ['soil']],
      [['cold', 'freezing', 'heat', 'hot'], ['temperature']],
      [['dust leaves', 'wipe leaves', 'wipe the leaves'], ['clean leaves']],
      [['container', 'pot size'], ['pot size']],
      [['drainage hole', 'holes'], ['drainage']],
      [['acclimatize', 'acclimatise', 'adjust'], ['acclimate']],
      [['rebloom', 'not blooming', 'won’t bloom', 'flowering'], ['bloom']],
      [['leggy', 'etiolation', 'stretched'], ['stretching', 'leggy']],
      [['shrivel', 'shriveling', 'wrinkle', 'wrinkled'], ['shriveling', 'wrinkled']],
      [['tip burn', 'brown edges', 'dry tips'], ['brown tips']],
      [['speckles', 'spots on leaves'], ['brown spots']],
      [['blackening', 'turning black'], ['black']],
      [['curled', 'curling leaves'], ['curling']]
    ],
    'zh-cn': [
      [['叶子黄', '叶黄', '发黄'], ['黄']],
      [['耷拉', '萎蔫', '蔫了', '下垂', '发软', '枯萎'], ['蔫', '下垂']],
      [['根腐', '根烂', '烂根了'], ['烂根']],
      [['蚧壳虫', '介壳虫', '蚧虫', '蚧'], ['盾蚧', '粉蚧']],
      [['小黑飞', '蕈蚊', '菌蚊', '飞虫', '小飞虫'], ['小黑飞']],
      [['白粉虱'], ['粉虱']],
      [['霉变', '长霉'], ['发霉']],
      [['移盆', '翻盆', '换土'], ['换盆']],
      [['扦插', '叶插', '枝插', '水插', '分株', '剪枝', '压条'], ['繁殖']],
      [['多久浇', '缺水', '积水', '浇透'], ['浇水']],
      [['干燥', '喷水', '加湿'], ['湿度']],
      [['阳光', '散光', '散射光', '遮光', '阴凉', '光照'], ['光']],
      [['营养液', '追肥', '施肥'], ['肥']],
      [['基质', '配土'], ['土']],
      [['怕冷', '过冬', '降温', '夏天热'], ['温度']],
      [['擦叶', '擦叶子', '清洁叶片'], ['擦叶']],
      [['盆器大小', '选多大盆'], ['盆']],
      [['漏水孔', '盆底孔'], ['排水']],
      [['新买', '适应新家'], ['缓苗']],
      [['催花', '复花', '花苞', '掉花', '不开花'], ['花']],
      [['长高', '细长'], ['徒长']],
      [['干尖', '焦尖', '叶尖枯'], ['干枯']],
      [['斑点'], ['褐斑']],
      [['黑叶', '叶子黑'], ['黑']],
      [['卷叶', '卷曲'], ['卷']]
    ],
    'zh-tw': [
      [['葉子黃', '葉黃', '發黃'], ['黃']],
      [['耷拉', '萎蔫', '蔫了', '下垂', '發軟', '枯萎'], ['蔫', '下垂']],
      [['根腐', '根爛', '爛根了'], ['爛根']],
      [['蚧殼蟲', '介殼蟲', '蚧蟲', '蚧'], ['盾蚧', '粉蚧']],
      [['小黑飛', '蕈蚊', '菌蚊', '飛蟲', '小飛蟲'], ['小黑飛']],
      [['白粉蝨'], ['粉蝨']],
      [['霉變', '長霉'], ['發霉']],
      [['移盆', '翻盆', '換土'], ['換盆']],
      [['扦插', '葉插', '枝插', '水插', '分株', '剪枝', '壓條'], ['繁殖']],
      [['多久澆', '缺水', '積水', '澆透'], ['澆水']],
      [['乾燥', '噴水', '加濕'], ['濕度']],
      [['陽光', '散光', '散射光', '遮光', '陰涼', '光照'], ['光']],
      [['營養液', '追肥', '施肥'], ['肥']],
      [['基質', '配土'], ['土']],
      [['怕冷', '過冬', '降溫', '夏天熱'], ['溫度']],
      [['擦葉', '擦葉子', '清潔葉片'], ['擦葉']],
      [['盆器大小', '選多大盆'], ['盆']],
      [['漏水孔', '盆底孔'], ['排水']],
      [['新買', '適應新家'], ['緩苗']],
      [['催花', '復花', '花苞', '掉花', '不開花'], ['花']],
      [['長高', '細長'], ['徒長']],
      [['乾尖', '焦尖', '葉尖枯'], ['乾枯']],
      [['斑點'], ['褐斑']],
      [['黑葉', '葉子黑'], ['黑']],
      [['卷葉', '捲曲'], ['卷']]
    ]
  };

  var dict = STR[lang] || STR.en;
  input.placeholder = dict.placeholder;
  var btn = document.getElementById('pm-search-btn');
  if (btn) btn.textContent = dict.button;

  var INDEX = [];
  var loaded = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function normalize(s) { return String(s || '').toLowerCase(); }

  function expand(query) {
    var q = normalize(query);
    var extra = [];
    (SYN[lang] || []).forEach(function (pair) {
      var variants = pair[0], canon = pair[1];
      variants.forEach(function (v) {
        if (q.indexOf(v) !== -1) extra = extra.concat(canon);
      });
    });
    return extra;
  }

  function tokens(q) {
    if (lang === 'en') {
      return q.toLowerCase().split(/[^a-z0-9]+/).filter(function (w) {
        return w.length > 1 && !STOP.en[w];
      });
    }
    return [q.replace(/\s+/g, '')];
  }

  function score(item, toks, extra) {
    var hayT = normalize(item.t);
    var hayD = normalize(item.d);
    var hayC = normalize(item.c);
    var hayK = normalize(item.k);
    var hay = hayT + ' ' + hayD + ' ' + hayC + ' ' + hayK;
    var s = 0;
    var terms = toks.concat(extra);
    if (!terms.length) return 0;
    terms.forEach(function (term) {
      if (!term) return;
      if (hayT.indexOf(term) !== -1) s += 3;
      else if (hayC.indexOf(term) !== -1) s += 2;
      else if (hayK.indexOf(term) !== -1) s += 1;
      else if (hayD.indexOf(term) !== -1) s += 1;
    });
    // phrase bonus: whole query appears in title
    if (hayT.indexOf(normalize(terms.join(' '))) !== -1) s += 2;
    return s;
  }

  function search(query) {
    var q = query.trim();
    if (!q) { hide(); return; }
    var toks = tokens(q);
    var extra = expand(q);
    var terms = toks.concat(extra).filter(Boolean);
    var hits = [];
    INDEX.forEach(function (item) {
      var sc = score(item, toks, extra);
      if (sc > 0) hits.push({ item: item, sc: sc });
    });
    hits.sort(function (a, b) { return b.sc - a.sc; });
    render(hits.slice(0, 10), q);
  }

  function render(hits, q) {
    if (!hits.length) {
      var catLinks = dict.cats.map(function (c) {
        return '<a href="' + c[0] + '">' + esc(c[1]) + '</a>';
      }).join('');
      box.innerHTML = '<div class="pm-search-empty"><p>' + esc(dict.empty.replace('{q}', q)) +
        '</p><div class="pm-sr-cats">' + catLinks + '</div></div>';
      box.hidden = false;
      return;
    }
    var list = hits.map(function (h) {
      var it = h.item;
      return '<a class="pm-sr-item" href="' + it.u + '">' +
        '<h3>' + esc(it.t) + '</h3>' +
        (it.d ? '<p>' + esc(it.d) + '</p>' : '') +
        (it.c ? '<span class="pm-sr-cat">' + esc(it.c) + '</span>' : '') +
        '</a>';
    }).join('');
    box.innerHTML = '<h2>' + esc(dict.heading) + ' · ' + hits.length + '</h2><div class="pm-sr-list">' + list + '</div>';
    box.hidden = false;
  }

  function hide() { box.hidden = true; box.innerHTML = ''; }

  var timer = null;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { search(input.value); }, 120);
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    search(input.value);
  });

  function load() {
    fetch('/assets/search.' + lang + '.json?v=20261125-2')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        INDEX = data || []; loaded = true;
        if (input.value.trim()) search(input.value);
      })
      .catch(function () { /* keep search hidden if index unavailable */ });
  }
  load();
})();
