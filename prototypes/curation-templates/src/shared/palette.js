/* ==========================================================================
   Lecta Palette Engine
   cover pixels -> swatches -> per-work theme -> curation theme

   Design rules (all enforced in code, not by convention):
   1. Colors come from the works. Nothing about hue is preset.
   2. Whatever the input, surfaces stay inside a quality envelope:
      - field   (dark/mid surface that carries white text) : contrast >= 4.8 vs white
      - tint    (pale surface)                             : never cream, beige, peach or yellow
      - paper   (page background)                          : near white, barely tinted, never warm
      - deep    (dark page background)                     : low lightness, low chroma
   3. Monochrome or colorless input falls back to a cool graphite theme.
   4. No cover at all falls back to a seeded color from a curated hue list,
      so a work without an image still gets a stable, good looking color.
   5. Only a tiny array [{hex, weight}] needs to be stored per work.
      Themes are rebuilt from it with no image (server side extraction works).
   ========================================================================== */
(function (root) {
  'use strict';

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- color math ---------- */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      var f = function (t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      var s = clamp(Math.round(v), 0, 255).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }
  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function luminance(rgb) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function rgbToLab(rgb) {
    var r = lin(rgb[0]), g = lin(rgb[1]), b = lin(rgb[2]);
    var x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    var y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
    var z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    var fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function deltaE(a, b) {
    var dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  function makeSwatch(rgb, weight) {
    var hs = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var lab = rgbToLab(rgb);
    return {
      rgb: rgb, hex: toHex(rgb), h: hs[0], s: hs[1], l: hs[2], lab: lab,
      chroma: Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]), weight: weight
    };
  }

  /* ---------- extraction ---------- */
  function medianCut(px, k) {
    var boxes = [px];
    function ranges(b) {
      var mn = [255, 255, 255], mx = [0, 0, 0];
      for (var i = 0; i < b.length; i++) {
        for (var c = 0; c < 3; c++) {
          if (b[i][c] < mn[c]) mn[c] = b[i][c];
          if (b[i][c] > mx[c]) mx[c] = b[i][c];
        }
      }
      return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    }
    while (boxes.length < k) {
      var bi = -1, best = 0;
      for (var i = 0; i < boxes.length; i++) {
        var bx = boxes[i];
        if (bx.length < 2) continue;
        var rg = ranges(bx);
        var sc = Math.max(rg[0], rg[1], rg[2]) * Math.sqrt(bx.length);
        if (sc > best) { best = sc; bi = i; }
      }
      if (bi < 0) break;
      var b = boxes[bi], r2 = ranges(b);
      var ch = r2[0] >= r2[1] && r2[0] >= r2[2] ? 0 : (r2[1] >= r2[2] ? 1 : 2);
      b.sort(function (p, q) { return p[ch] - q[ch]; });
      var mid = b.length >> 1;
      boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
    }
    return boxes.map(function (b) {
      var s = [0, 0, 0];
      for (var i = 0; i < b.length; i++) { s[0] += b[i][0]; s[1] += b[i][1]; s[2] += b[i][2]; }
      return { rgb: [s[0] / b.length, s[1] / b.length, s[2] / b.length].map(Math.round), n: b.length };
    });
  }

  function swatchesFromPixels(data) {
    var px = [];
    for (var i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (px.length < 8) return [];
    var total = px.length;
    var sw = medianCut(px, 10)
      .map(function (b) { return makeSwatch(b.rgb, b.n / total); })
      .sort(function (a, b) { return b.weight - a.weight; });
    var out = [];
    sw.forEach(function (s) {
      var idx = -1;
      for (var i = 0; i < out.length; i++) { if (deltaE(out[i].lab, s.lab) < 14) { idx = i; break; } }
      if (idx < 0) { out.push(s); return; }
      var m = out[idx], w = m.weight + s.weight;
      var rgb = [0, 1, 2].map(function (c) { return Math.round((m.rgb[c] * m.weight + s.rgb[c] * s.weight) / w); });
      out[idx] = makeSwatch(rgb, w);
    });
    return out.sort(function (a, b) { return b.weight - a.weight; });
  }

  function samplePixels(img, maxSide) {
    try {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) return null;
      var sc = Math.min(1, maxSide / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      /* ignore a 4% border: posters and books often have blank margins */
      ctx.drawImage(img, w * 0.04, h * 0.04, w * 0.92, h * 0.92, 0, 0, cw, ch);
      return ctx.getImageData(0, 0, cw, ch).data;
    } catch (e) { return null; } /* tainted canvas (no CORS): extract server side instead */
  }

  function extract(img) {
    var d = samplePixels(img, 72);
    return d ? swatchesFromPixels(d) : [];
  }

  /* compact storable form: [{hex, weight}] */
  function pack(swatches) {
    return swatches.slice(0, 6).map(function (s) { return { hex: s.hex, weight: Math.round(s.weight * 1000) / 1000 }; });
  }
  function hydrate(stored) {
    return (stored || []).map(function (s) { return makeSwatch(hexToRgb(s.hex), s.weight); });
  }

  /* ---------- names ---------- */
  /* Placeholder table. Replace with the repo's room color table if there is one. */
  var NAMES = [
    ['Etruscan Red', '#B5584C'], ['Vermilion', '#B8412C'], ['Garnet', '#7A2434'], ['Rosewood', '#8C4A4F'],
    ['Mulberry', '#6E2E4A'], ['Plum', '#5A3358'], ['Burnt Sienna', '#A4552F'], ['Terracotta', '#B0614A'],
    ['Umber', '#5E4332'], ['Rust', '#9A4B2A'], ['Cinnamon', '#8A5A3C'], ['Old Gold', '#8A6D2A'],
    ['Olive', '#6B6B34'], ['Moss', '#55663A'], ['Bronze', '#7A5C2E'], ['Fern', '#4F7A54'],
    ['Pine', '#2F5D4B'], ['Bottle Green', '#1F4A3D'], ['Sage', '#70876F'], ['Verdigris', '#3D7F78'],
    ['Teal', '#1F6F78'], ['Lagoon', '#2D7B8F'], ['Petrol', '#1E4F5E'], ['Cobalt', '#2F4FA8'],
    ['Ultramarine', '#3A3FA0'], ['Prussian Blue', '#1F3C5C'], ['Steel Blue', '#4A6D8F'], ['Cornflower', '#6A85C2'],
    ['Slate Blue', '#55608A'], ['Midnight', '#1B2440'], ['Violet', '#5F3FA0'], ['Aubergine', '#3F2A4A'],
    ['Heather', '#7A6A94'], ['Orchid', '#8A4F8F'], ['Graphite', '#3A3D44'], ['Charcoal', '#2A2C31'],
    ['Pewter', '#6B7078'], ['Ash', '#8A8E94']
  ].map(function (n) { var rgb = hexToRgb(n[1]); return { name: n[0], lab: rgbToLab(rgb) }; });

  function nameOf(rgb) {
    var lab = rgbToLab(rgb), best = null, bd = 1e9;
    for (var i = 0; i < NAMES.length; i++) {
      var d = deltaE(lab, NAMES[i].lab);
      if (d < bd) { bd = d; best = NAMES[i].name; }
    }
    return best;
  }

  /* ---------- seeded fallback (no cover) ---------- */
  var SEED_BASES = [[352, 0.48, 0.36], [8, 0.5, 0.38], [200, 0.5, 0.34], [222, 0.5, 0.38], [262, 0.4, 0.4], [168, 0.4, 0.3], [330, 0.4, 0.38], [188, 0.5, 0.32]];
  function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- per work theme ---------- */
  var WARM_PALE = [13, 95];   /* hue band where a pale surface reads as cream, beige, peach or yellow */
  var YELLOWISH = [28, 88];   /* hue band where a dark surface drifts toward mustard */

  function tones(h, s, l, mono) {
    if (mono) { h = 218; s = 0.06; }
    var yellowish = !mono && h >= YELLOWISH[0] && h <= YELLOWISH[1];
    var warmPale = !mono && h >= WARM_PALE[0] && h <= WARM_PALE[1];

    /* field: surface that carries white text */
    var fs = mono ? 0.07 : clamp(s, 0.30, 0.64);
    var fl = mono ? 0.24 : (yellowish ? clamp(l, 0.16, 0.25) : clamp(l, 0.28, 0.42));
    if (yellowish) fs = Math.min(fs, 0.34);
    var field = hslToRgb(h, fs, fl), guard = 0;
    while (contrast(field, [255, 255, 255]) < 4.8 && guard++ < 40) { fl -= 0.012; field = hslToRgb(h, fs, fl); }

    /* tint, paper: pale surfaces. warm hues fall back to a cool neutral. */
    var cool = mono || warmPale;
    var th = cool ? 216 : h;
    var tint = hslToRgb(th, cool ? 0.12 : clamp(s * 0.55, 0.16, 0.34), 0.925);
    var paper = hslToRgb(th, cool ? 0.08 : 0.10, 0.968);
    var ink = hslToRgb(th, 0.28, 0.11);

    /* dark mode */
    var deep = hslToRgb(h, mono ? 0.06 : clamp(s * 0.4, 0.10, 0.26), 0.075);
    var soft = hslToRgb(h, mono ? 0.05 : clamp(s * 0.7, 0.22, 0.5), 0.17);
    var glow = hslToRgb(h, mono ? 0.12 : clamp(s, 0.5, 0.82), mono ? 0.78 : (yellowish ? 0.62 : 0.7));

    var onField = hslToRgb(h, 0.2, 0.975);
    if (contrast(field, onField) < 4.5) onField = [255, 255, 255];

    return {
      field: toHex(field), tint: toHex(tint), paper: toHex(paper), ink: toHex(ink),
      deep: toHex(deep), soft: toHex(soft), glow: toHex(glow), onField: toHex(onField),
      fieldRgb: field, fieldLab: rgbToLab(field), hue: h
    };
  }

  function buildWorkTheme(swatches, seed) {
    var sw = (swatches || []).filter(function (s) { return s.lab[0] > 14 && s.lab[0] < 93; });
    var base = null, fromSeed = false;
    if (sw.length) {
      sw.forEach(function (s) { s.score = s.chroma * (0.35 + Math.sqrt(s.weight)); });
      sw.sort(function (a, b) { return b.score - a.score; });
      base = sw[0];
    } else if (!swatches || !swatches.length) {
      var sb = SEED_BASES[hashStr(seed || 'x') % SEED_BASES.length];
      base = { h: sb[0], s: sb[1], l: sb[2], chroma: 40, hex: toHex(hslToRgb(sb[0], sb[1], sb[2])) };
      fromSeed = true;
    }
    var mono = !base || base.chroma < 10;
    var t = tones(base ? base.h : 218, base ? base.s : 0.05, base ? base.l : 0.3, mono);

    /* how light the cover is overall: decides whether a mat should be dark or pale behind it */
    var coverL = 0.5;
    if (swatches && swatches.length) {
      coverL = swatches.reduce(function (a, s) { return a + (s.lab[0] / 100) * s.weight; }, 0);
    }
    t.name = nameOf(t.fieldRgb);
    t.mono = mono;
    t.fromSeed = fromSeed;
    t.coverL = coverL;
    t.swatches = pack(swatches || []);
    return t;
  }

  /* ---------- curation theme ---------- */
  /* items: [{id, theme}], heroId, accentIndex (optional user choice among chips) */
  function buildCurationTheme(items, heroId, accentIndex) {
    var chips = [];
    items.forEach(function (it) {
      var t = it.theme;
      if (!t || t.mono) return;
      for (var i = 0; i < chips.length; i++) if (deltaE(chips[i].lab, t.fieldLab) < 16) return;
      chips.push({ hex: t.field, name: t.name, lab: t.fieldLab, theme: t });
    });
    var hero = null;
    for (var i = 0; i < items.length; i++) if (items[i].id === heroId) hero = items[i];
    hero = hero || items[0];
    var primary = hero && hero.theme;
    if (primary && primary.mono && chips.length) primary = chips[0].theme;
    if (typeof accentIndex === 'number' && chips[accentIndex]) primary = chips[accentIndex].theme;
    if (!primary) primary = buildWorkTheme([], 'empty');
    if (!chips.length) chips.push({ hex: primary.field, name: primary.name, lab: primary.fieldLab, theme: primary });
    var idx = 0;
    chips.forEach(function (c, k) { if (c.theme === primary) idx = k; });
    return {
      primary: primary,
      chips: chips.map(function (c) { return { hex: c.hex, name: c.name }; }),
      accentIndex: idx
    };
  }

  /* css custom properties for one theme */
  function cssVars(t) {
    return '--field:' + t.field + ';--tint:' + t.tint + ';--paper:' + t.paper + ';--ink:' + t.ink +
      ';--deep:' + t.deep + ';--soft:' + t.soft + ';--glow:' + t.glow + ';--on-field:' + t.onField + ';';
  }

  root.LectaPalette = {
    extract: extract, fromPixels: swatchesFromPixels, pack: pack, hydrate: hydrate,
    buildWorkTheme: buildWorkTheme, buildCurationTheme: buildCurationTheme,
    cssVars: cssVars, nameOf: nameOf, contrast: contrast, hexToRgb: hexToRgb, toHex: toHex,
    hsl: function (h, s, l) { return toHex(hslToRgb(h, s, l)); }, deltaE: deltaE, rgbToLab: rgbToLab
  };
})(typeof window !== 'undefined' ? window : globalThis);
