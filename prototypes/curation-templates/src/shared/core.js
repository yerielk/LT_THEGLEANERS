/* ==========================================================================
   Lecta template core
   - blog style input parsing (paragraphs, "> quote", **bold**, *italic*)
   - content buckets and the spread planner (same data, rule based layouts)
   - load covers, extract palettes, build themes
   - scenes: stills the author inserts. No scene means the cover is shown instead
   - embed channel: the curation editor feeds data in with postMessage
   - preview controls (prototype only, removed on merge)
   ========================================================================== */
(function (root) {
  'use strict';
  var P = root.LectaPalette, S = root.LectaSamples;
  var L = root.Lecta = {};
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  L.reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MEDIA = { film: 'Film', series: 'Series', book: 'Book', album: 'Album' };
  L.mediumLabel = function (it) { return MEDIA[it.medium] || 'Film'; };
  L.pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------- text ---------- */
  L.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  /* escape first, then allow only **bold**, *italic* and line breaks */
  L.rich = function (s) {
    var e = L.esc(s);
    e = e.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    return e.replace(/\n/g, '<br>');
  };
  L.parseNote = function (raw) {
    var paras = [], quotes = [], quoteAt = 0, seenQuote = false;
    String(raw || '').replace(/\r/g, '').split(/\n{2,}/).forEach(function (b) {
      b = b.trim();
      if (!b) return;
      if (b.charAt(0) === '>') {
        var q = b.replace(/^>\s*/gm, '').trim();
        if (q) { quotes.push(q); if (!seenQuote) { quoteAt = paras.length; seenQuote = true; } }
      } else { paras.push(b); }
    });
    return { paras: paras, quotes: quotes, quoteAt: quoteAt };
  };
  /* length bucket decides which layouts are allowed */
  L.bucket = function (len, n) {
    if (!len) return 'none';
    if (len <= 90 && n <= 1) return 'line';
    if (len <= 260 && n <= 2) return 'short';
    if (len <= 600 && n <= 4) return 'medium';
    return 'long';
  };
  /* visual length: Hangul and CJK count wider */
  L.vlen = function (s) {
    var n = 0; s = String(s);
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); n += (c >= 0x1100 && c <= 0xD7FF) || (c >= 0x3000 && c <= 0x9FFF) ? 1.7 : 1; }
    return n;
  };
  /* title size class: every template maps t1..t5 to its own type scale */
  L.tcls = function (s) {
    var v = L.vlen(s);
    return v <= 10 ? 't1' : v <= 20 ? 't2' : v <= 34 ? 't3' : v <= 56 ? 't4' : 't5';
  };
  L.hk = function (s) { return /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(s) ? 'hk' : ''; };
  L.metaLine = function (it) { return [L.mediumLabel(it), it.year].filter(Boolean).join(', '); };
  L.credit = function (it) { return [it.creator, it.year].filter(Boolean).join(', '); };

  /* paragraphs and the explicit quote, in the author's order */
  L.bodyHTML = function (it, o) {
    o = o || {};
    var out = '', q = it.quote;
    it.paras.forEach(function (p, i) {
      if (q && !o.noQuote && i === it.quoteAt) out += '<blockquote class="pq ' + (L.hk(q) ? 'kr' : '') + '">' + L.rich(q) + '</blockquote>';
      out += '<p>' + L.rich(p) + '</p>';
    });
    if (q && !o.noQuote && it.quoteAt >= it.paras.length) out += '<blockquote class="pq ' + (L.hk(q) ? 'kr' : '') + '">' + L.rich(q) + '</blockquote>';
    return out;
  };

  /* ---------- item model ---------- */
  /* the one-line reason and the long note are read as one text, reason first */
  function sceneOf(x) {
    if (!x) return null;
    if (typeof x === 'string') x = { src: x };
    var src = x.src || (x.kind ? S.svgUri(S.ART.photo(x.colors)) : null);
    return src ? { src: src, caption: String(x.caption || '').trim(), ar: x.ar || null } : null;
  }
  L.normalizeItem = function (raw, i) {
    var reason = String(raw.reason || '').trim();
    var text = [reason, raw.note].filter(function (v) { return v && String(v).trim(); }).join('\n\n');
    var pn = L.parseNote(text), len = pn.paras.join('').length;
    var coverSrc = raw.cover && raw.cover.src ? raw.cover.src : null;
    if (!coverSrc && raw.art && !raw.noCover) coverSrc = S.svgUri(S.ART[raw.art.kind](raw.art.colors, raw.title, raw.creator));
    var scenes = (raw.scenes || []).map(sceneOf).filter(Boolean);
    var legacy = sceneOf(raw.photo); if (legacy && !scenes.length) scenes = [legacy];
    return {
      id: String(raw.id || ('w' + i)),
      medium: MEDIA[raw.medium] ? raw.medium : 'film',
      title: String(raw.title || '').trim() || 'Untitled',
      creator: String(raw.creator || '').trim(),
      year: raw.year ? String(raw.year) : '',
      reason: reason,
      paras: pn.paras, quote: pn.quotes[0] || '', quoteAt: pn.quoteAt,
      noteLen: len, bucket: L.bucket(len, pn.paras.length),
      featured: !!raw.featured,
      layout: raw.layout && raw.layout !== 'auto' ? String(raw.layout) : '',
      cover: { src: coverSrc, ar: 0.667, placeholder: !coverSrc },
      scenes: scenes,
      photo: scenes[0] || null,
      palette: raw.palette || null
    };
  };

  L.loadImage = function (src, timeout) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var img = new Image(), done = false;
      var fin = function (v) { if (done) return; done = true; clearTimeout(t); res(v); };
      var t = setTimeout(function () { fin(null); }, timeout || 6000);
      img.onload = function () { fin(img); };
      img.onerror = function () { fin(null); };
      if (src.indexOf('data:') !== 0) img.crossOrigin = 'anonymous';
      img.src = src;
    });
  };

  /* images -> swatches -> themes. A stored palette skips the image work entirely. */
  L.prepareItem = function (it) {
    var sceneJobs = it.scenes.map(function (sc) {
      return L.loadImage(sc.src).then(function (img) {
        if (img) sc.ar = clamp(img.naturalWidth / img.naturalHeight, 0.4, 2.6);
        sc.img = img; return img ? sc : null;
      });
    });
    return Promise.all([L.loadImage(it.cover.src), Promise.all(sceneJobs)]).then(function (r) {
      var img = r[0], sw = [];
      it.scenes = r[1].filter(Boolean); it.photo = it.scenes[0] || null;
      if (it.palette && it.palette.length) sw = P.hydrate(it.palette);
      if (img) {
        it.cover.ar = clamp(img.naturalWidth / img.naturalHeight, 0.45, 2.2);
        if (!sw.length) sw = P.extract(img);
      } else { it.cover.src = null; }
      if (!sw.length && it.photo && it.photo.img) sw = P.extract(it.photo.img);
      it.cover.placeholder = !it.cover.src;
      it.theme = P.buildWorkTheme(sw, it.id + it.title);
      it.palette = P.pack(sw);
      it.scenes.forEach(function (sc) { delete sc.img; });
      return it;
    });
  };

  /* ---------- spread planner ----------
     types: { name: { fits:[buckets], weight:'dense|mid|sparse', needs:fn(item), feature:bool, spaced:n } }
     A type may carry kind: 'page' | 'inset' | 'full' | 'quote' | 'plate'. An item whose author picked a layout
     (item.layout) gets the first type of that kind, as long as the item can fill it. Otherwise the rules decide.
     Rules: never the same type twice, never two dense in a row, never three sparse in a row.
     Returns [{type, variant, bucket}] where variant counts earlier uses of that type. */
  L.plan = function (items, types) {
    var names = Object.keys(types), out = [], counts = {}, hist = [];
    items.forEach(function (it, i) {
      if (it.layout) {
        var want = names.filter(function (n) { var t = types[n]; return t.kind === it.layout && (!t.needs || t.needs(it)); })[0];
        if (want) { counts[want] = (counts[want] || 0) + 1; hist.push(want); out.push({ type: want, variant: counts[want] - 1, bucket: it.bucket, chosen: true }); return; }
      }
      var c = names.filter(function (n) {
        var t = types[n];
        return t.fits.indexOf(it.bucket) > -1 && (!t.needs || t.needs(it));
      });
      if (!c.length) c = [names[0]];
      var feat = c.filter(function (n) { return types[n].feature; });
      if ((it.featured || it.photo) && feat.length) c = feat;
      var order = c.map(function (_, j) { return c[(j + i) % c.length]; });
      /* a type flagged prefer wins when the item qualifies (an explicit quote earns its own page) */
      var pref = order.filter(function (n) { return types[n].prefer; });
      if (pref.length) order = pref.concat(order.filter(function (n) { return !types[n].prefer; }));
      var last = hist[hist.length - 1];
      var ok = function (n) {
        var t = types[n];
        if (n === last) return false;
        if (t.weight === 'dense' && hist.length && types[last].weight === 'dense') return false;
        if (t.weight === 'sparse' && hist.length > 1 && types[last].weight === 'sparse' && types[hist[hist.length - 2]].weight === 'sparse') return false;
        if (t.spaced && hist.slice(-t.spaced).indexOf(n) > -1) return false;
        return true;
      };
      var pick = null;
      for (var k = 0; k < order.length; k++) { if (ok(order[k])) { pick = order[k]; break; } }
      if (!pick) pick = order.filter(function (n) { return n !== last; })[0] || order[0];
      counts[pick] = (counts[pick] || 0) + 1;
      hist.push(pick);
      out.push({ type: pick, variant: counts[pick] - 1, bucket: it.bucket });
    });
    L.kinds = names.map(function (n) { return types[n].kind; }).filter(function (k, i, a) { return k && a.indexOf(k) === i; });
    L.planned = out.map(function (o, i) { return { id: items[i].id, type: o.type, kind: types[o.type].kind || '', chosen: !!o.chosen }; });
    return out;
  };

  /* ---------- html helpers ---------- */
  L.themeStyle = function (it) { return P.cssVars(it.theme); };
  /* cover frame always has the cover's own aspect, so object-fit:contain never letterboxes */
  L.cover = function (it, o) {
    o = o || {};
    var st = '--ar:' + it.cover.ar.toFixed(4) + ';' + (o.ch ? '--ch:' + o.ch + ';' : '') + (o.cw ? '--cw:' + o.cw + ';' : '') + (o.style || '');
    if (it.cover.src) {
      return '<figure class="cv ' + (o.cls || '') + '" style="' + st + '"><img src="' + L.esc(it.cover.src) + '" alt="' + L.esc(it.title) + (it.creator ? ', ' + L.esc(it.creator) : '') + '" decoding="async" draggable="false"></figure>';
    }
    return '<div class="cv ph ' + (o.cls || '') + '" style="' + st + '" role="img" aria-label="' + L.esc(it.title) + '"><span class="ph-m">' + L.esc(L.mediumLabel(it)) + '</span><span class="ph-t">' + L.esc(it.title) + '</span></div>';
  };

  /* the visual of a work: the author's first scene, or the cover when there is none */
  L.visual = function (it, o) {
    var sc = it.scenes && it.scenes[0];
    if (!sc) return L.cover(it, o);
    return L.figure(sc, it.title, o);
  };
  L.figure = function (sc, alt, o) {
    o = o || {};
    var st = '--ar:' + (sc.ar || 1.5).toFixed(4) + ';' + (o.ch ? '--ch:' + o.ch + ';' : '') + (o.cw ? '--cw:' + o.cw + ';' : '') + (o.style || '');
    return '<figure class="cv ' + (o.cls || '') + '" style="' + st + '"><img src="' + L.esc(sc.src) + '" alt="' + L.esc(sc.caption || alt || '') + '" decoding="async" draggable="false"></figure>';
  };
  /* every image the work brings to a page: its scenes, or the cover alone */
  L.media = function (it) {
    return it.scenes && it.scenes.length ? it.scenes : [{ src: it.cover.src, ar: it.cover.ar, caption: '', isCover: true }];
  };

  /* ---------- lifecycle ---------- */
  var cleanups = [];
  L.onCleanup = function (fn) { cleanups.push(fn); };
  L.cleanup = function () { var c = cleanups; cleanups = []; c.forEach(function (f) { try { f(); } catch (e) { } }); };

  L.reveal = function (rootEl) {
    var els = [].slice.call(rootEl.querySelectorAll('[data-r]'));
    els.forEach(function (e) { if (e.dataset.d) e.style.setProperty('--d', e.dataset.d); });
    if (L.reduced || !('IntersectionObserver' in root)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
    L.onCleanup(function () { io.disconnect(); });
  };

  /* calls fn(el) for the element crossing the band defined by margin */
  L.spy = function (els, fn, margin) {
    if (!('IntersectionObserver' in root) || !els.length) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) fn(e.target); });
    }, { rootMargin: margin || '-45% 0px -45% 0px', threshold: 0 });
    els.forEach(function (e) { io.observe(e); });
    L.onCleanup(function () { io.disconnect(); });
  };

  L.onScroll = function (fn) {
    var tick = false;
    var h = function () { if (tick) return; tick = true; requestAnimationFrame(function () { tick = false; fn(); }); };
    root.addEventListener('scroll', h, { passive: true });
    root.addEventListener('resize', h);
    L.onCleanup(function () { root.removeEventListener('scroll', h); root.removeEventListener('resize', h); });
    fn();
  };

  /* ---------- state, prepare, boot ---------- */
  var state = (function () {
    var q = new URLSearchParams(root.location.search);
    var s = { set: q.get('set') || 'A', n: q.get('n') || 'all', notes: q.get('notes') || 'asis', labels: q.get('labels') === '1', accent: q.has('accent') ? parseInt(q.get('accent'), 10) : null };
    if (!S.SETS[s.set]) s.set = 'A';
    return s;
  })();
  function writeState() {
    try {
      var q = new URLSearchParams();
      q.set('set', state.set); q.set('n', state.n); q.set('notes', state.notes);
      if (state.labels) q.set('labels', '1');
      if (state.accent != null) q.set('accent', state.accent);
      root.history.replaceState(null, '', '?' + q.toString());
    } catch (e) { }
  }

  /* data pushed in by the curation editor: { title, subtitle, curator, intro, heroId, accentIndex, items } */
  var external = null;
  L.embedded = /(^|[?&])embed=1/.test(root.location.search);
  L.feed = L.embedded || /(^|[?&])feed=1/.test(root.location.search);
  L.setData = function (d) { external = d; if (L.rerun) L.rerun(); };

  L.prepare = function () {
    var ex0 = external || S.SETS[state.set].ex;
    var raws = (ex0.items || []).slice();
    if (!external && state.n !== 'all') raws = raws.slice(0, parseInt(state.n, 10) || raws.length);
    var items = raws.map(function (r, i) {
      var rr = {}; for (var k in r) rr[k] = r[k];
      if (!external && state.notes === 'none') { rr.note = ''; rr.reason = ''; }
      else if (!external && state.notes === 'long') rr.note = S.long(4) + '\n\n' + S.long(3);
      return L.normalizeItem(rr, i);
    });
    return Promise.all(items.map(L.prepareItem)).then(function () {
      var heroId = items.some(function (i) { return i.id === ex0.heroId; }) ? ex0.heroId : (items[0] && items[0].id);
      var theme = P.buildCurationTheme(items, heroId, external && external.accentIndex != null ? external.accentIndex : state.accent);
      var hero = items.filter(function (i) { return i.id === heroId; })[0] || items[0];
      return {
        title: String(ex0.title || '').trim() || 'Untitled', subtitle: ex0.subtitle || '', curator: ex0.curator || '',
        intro: ex0.intro ? String(ex0.intro).split(/\n{2,}/) : [],
        items: items, heroId: heroId, hero: hero, theme: theme
      };
    });
  };

  L.boot = function (opts) {
    var app = document.getElementById('app'), seq = 0, first = true;
    function run() {
      var my = ++seq, keep = root.pageYOffset;
      app.classList.add('is-loading');
      L.prepare().then(function (ex) {
        if (my !== seq) return;
        L.cleanup();
        app.innerHTML = '';
        var t = ex.theme.primary;
        var r = document.documentElement.style;
        r.setProperty('--paper', t.paper); r.setProperty('--ink', t.ink);
        r.setProperty('--xfield', t.field); r.setProperty('--xdeep', t.deep);
        r.setProperty('--xglow', t.glow); r.setProperty('--xsoft', t.soft); r.setProperty('--xtint', t.tint);
        opts.render(ex, app);
        document.body.classList.toggle('show-labels', !!state.labels);
        if (!L.feed) preview(ex);
        L.last = ex;
        L.reveal(app);
        /* an embedded preview keeps its scroll position while the author types */
        if (external && !first) root.scrollTo({ top: keep, behavior: 'instant' }); else root.scrollTo({ top: 0, behavior: 'instant' });
        first = false;
        /* the editor asks to land on a work after a structural change (layout, scenes, order) */
        if (external && external.focus != null) {
          if (external.focus < 0) root.scrollTo({ top: 0, behavior: 'instant' });
          else { var fe = app.querySelector('[data-i="' + external.focus + '"]'); if (fe) fe.scrollIntoView({ block: 'start', behavior: 'instant' }); }
          lastView = external.focus;
        }
        requestAnimationFrame(function () { app.classList.remove('is-loading'); });
        var tgt = root.opener || (root.parent !== root ? root.parent : null);
        if (L.feed && tgt) {
          tgt.postMessage({ type: 'lecta:state', chips: ex.theme.chips, accentIndex: ex.theme.accentIndex, plan: L.planned || [], kinds: L.kinds || [], palettes: ex.items.map(function (i) { return { id: i.id, palette: i.palette, ar: i.cover.ar }; }) }, '*');
        }
      });
    }
    L.rerun = run;
    /* the editor follows the reader: report which page sits in the middle of the viewport */
    var lastView = null, viewTick = 0;
    function reportView() {
      viewTick = 0;
      var tgt = root.parent !== root ? root.parent : null; if (!tgt) return;
      var mid = root.innerHeight * 0.45, idx = -1;
      [].forEach.call(app.querySelectorAll('[data-i]'), function (el) { var r = el.getBoundingClientRect(); if (r.top <= mid && r.height) { var n = +el.getAttribute('data-i'); if (!isNaN(n) && n > idx) idx = n; } });
      if (idx !== lastView) { lastView = idx; tgt.postMessage({ type: 'lecta:view', index: idx }, '*'); }
    }
    if (L.embedded) root.addEventListener('scroll', function () { if (!viewTick) viewTick = requestAnimationFrame(reportView); }, { passive: true });
    if (L.feed) {
      if (L.embedded) document.documentElement.classList.add('embed');
      root.addEventListener('message', function (e) {
        var d = e.data || {};
        if (d.type === 'lecta:curation') { external = d.data; run(); }
        else if (d.type === 'lecta:goto') {
          lastView = d.index;
          if (d.index < 0) root.scrollTo({ top: 0, behavior: 'instant' });
          else { var el = document.querySelector('[data-i="' + d.index + '"]') || document.getElementById('s-' + d.index); if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' }); }
        }
      });
      var t0 = root.opener || (root.parent !== root ? root.parent : null);
      if (t0) t0.postMessage({ type: 'lecta:ready' }, '*');
    } else { run(); }
  };

  /* ---------- preview controls (prototype only) ---------- */
  function preview(ex) {
    var el = document.getElementById('pv');
    if (!el) {
      el = document.createElement('div'); el.id = 'pv';
      var opt = function (v, t, cur) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + t + '</option>'; };
      el.innerHTML =
        '<button class="pv-b" type="button" aria-expanded="false">Preview</button>' +
        '<div class="pv-p" hidden>' +
        '<label>Sample<select data-k="set">' + Object.keys(S.SETS).map(function (k) { return opt(k, S.SETS[k].label, state.set); }).join('') + '</select></label>' +
        '<label>Works<select data-k="n">' + ['all', '1', '3', '6'].map(function (v) { return opt(v, v === 'all' ? 'All' : v, state.n); }).join('') + '</select></label>' +
        '<label>Notes<select data-k="notes">' + opt('asis', 'As written', state.notes) + opt('none', 'No notes', state.notes) + opt('long', 'Very long notes', state.notes) + '</select></label>' +
        '<label class="pv-c"><input type="checkbox" data-k="labels"' + (state.labels ? ' checked' : '') + '>Show layout labels</label>' +
        '<div class="pv-t">Main color (extracted from the works)</div><div class="pv-chips"></div>' +
        '<button class="pv-copy" type="button">Copy palette JSON</button></div>';
      document.body.appendChild(el);
      var btn = el.querySelector('.pv-b'), panel = el.querySelector('.pv-p');
      btn.addEventListener('click', function () {
        var open = panel.hasAttribute('hidden');
        if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', String(open));
      });
      el.addEventListener('change', function (e) {
        var k = e.target.getAttribute('data-k'); if (!k) return;
        if (k === 'labels') { state.labels = e.target.checked; document.body.classList.toggle('show-labels', state.labels); writeState(); return; }
        state[k] = e.target.value;
        if (k === 'set') state.accent = null;
        writeState(); L.rerun();
      });
      el.querySelector('.pv-chips').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-i]'); if (!b) return;
        state.accent = parseInt(b.getAttribute('data-i'), 10); writeState(); L.rerun();
      });
      el.querySelector('.pv-copy').addEventListener('click', function (e) {
        var data = JSON.stringify(L.last.items.map(function (i) { return { id: i.id, palette: i.palette }; }), null, 1);
        var b = e.target;
        (navigator.clipboard ? navigator.clipboard.writeText(data) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Copy blocked in this view'; });
        setTimeout(function () { b.textContent = 'Copy palette JSON'; }, 1600);
      });
    }
    el.querySelector('.pv-chips').innerHTML = ex.theme.chips.map(function (c, i) {
      return '<button type="button" data-i="' + i + '" class="' + (i === ex.theme.accentIndex ? 'on' : '') + '" title="' + L.esc(c.name) + '"><i style="background:' + c.hex + '"></i>' + L.esc(c.name) + '</button>';
    }).join('');
  }

  /* ---------- shared css ---------- */
  var css = [
    ':root{--field:#394150;--on-field:#fff;--tint:#EAEBEE;--paper:#F6F7F9;--ink:#14171C;--deep:#101216;--soft:#1c2029;--glow:#9db0d0}',
    '.cv{display:block;margin:0;position:relative;aspect-ratio:var(--ar);width:min(var(--cw,100%),calc(var(--ch,60vh) * var(--ar)));flex:none}',
    '.cv img{display:block;width:100%;height:100%;object-fit:contain;user-select:none}',
    '.cv.ph{display:flex;flex-direction:column;justify-content:flex-end;gap:.5em;padding:9%;background:var(--field);color:var(--on-field);overflow:hidden;container-type:inline-size}',
    '.cv.ph .ph-m{font:600 clamp(6px,5cqw,10px)/1 var(--sans,system-ui);letter-spacing:.16em;text-transform:uppercase;opacity:.7}',
    '.cv.ph .ph-t{font:400 clamp(9px,13cqw,30px)/1.12 var(--serif,Georgia,serif);display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
    '[data-r]{opacity:0;transition:opacity .9s cubic-bezier(.2,.7,.2,1) var(--d,0ms),transform 1s cubic-bezier(.2,.7,.2,1) var(--d,0ms)}',
    '[data-r=up]{transform:translateY(34px)}[data-r=left]{transform:translateX(-46px)}[data-r=right]{transform:translateX(46px)}[data-r=scale]{transform:scale(.94)}',
    '[data-r].in{opacity:1;transform:none}',
    '#app{transition:opacity .5s ease}#app.is-loading{opacity:0}',
    'body.show-labels [data-spread]{position:relative}',
    'body.show-labels [data-spread]::after{content:attr(data-spread);position:absolute;top:8px;left:8px;z-index:60;font:600 10px/1 ui-monospace,Menlo,monospace;background:#111;color:#7CFFB2;padding:4px 6px;border-radius:3px;pointer-events:none}',
    '@media (prefers-reduced-motion:reduce){[data-r]{opacity:1!important;transform:none!important;transition:none!important}}',
    '#pv{position:fixed;right:14px;bottom:14px;z-index:99999;font:12px/1.35 system-ui,-apple-system,sans-serif;color:#eee}',
    '#pv .pv-b{display:block;margin-left:auto;background:rgba(18,20,24,.82);color:#fff;border:0;border-radius:99px;padding:7px 13px;font:600 11px/1 system-ui;letter-spacing:.04em;cursor:pointer;backdrop-filter:blur(10px)}',
    '#pv .pv-p{width:268px;margin-top:8px;padding:14px;border-radius:14px;background:rgba(18,20,24,.92);backdrop-filter:blur(14px);box-shadow:0 18px 40px rgba(0,0,0,.35)}',
    '#pv label{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;color:#b9bec7}',
    '#pv select{max-width:170px;background:#242830;color:#eee;border:0;border-radius:6px;padding:5px 6px;font:inherit}',
    '#pv .pv-c{justify-content:flex-start}#pv .pv-t{margin:12px 0 6px;color:#b9bec7}',
    '#pv .pv-chips{display:flex;flex-direction:column;gap:3px;max-height:150px;overflow:auto}',
    '#pv .pv-chips button{display:flex;align-items:center;gap:8px;background:transparent;color:#d9dce2;border:0;border-radius:6px;padding:4px 6px;text-align:left;font:inherit;cursor:pointer}',
    '#pv .pv-chips button.on{background:#2c313b;color:#fff}#pv .pv-chips i{width:14px;height:14px;border-radius:50%;flex:none}',
    '#pv .pv-copy{margin-top:10px;width:100%;background:#2c313b;color:#fff;border:0;border-radius:8px;padding:8px;font:inherit;cursor:pointer}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'lecta-core'; st.textContent = css; document.head.appendChild(st);
})(window);
