/* ==========================================================================
   LectaSequence: pure data helpers for the Curation Editor v5.
   No DOM. The editor's drag, keyboard and menu UI call these, so a later
   React port can swap the UI layer for dnd-kit and keep this file.

   - move / dropIndex / step:   reorder by stable id
   - ensureIds:                 keep saved work ids, repair empty or duplicate ones
   - readDraft:                 read v3 draft, fall back to v2 without touching it
   - textStats:                 the same length bucket the templates use
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LectaSequence = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY_V3 = 'lecta.curation.draft.v3';
  var KEY_V2 = 'lecta.curation.draft.v2';

  /* move the item at `from` so that it ends at index `to`. Returns a new array. */
  function move(list, from, to) {
    var out = list.slice();
    if (from < 0 || from >= out.length) return out;
    to = Math.max(0, Math.min(out.length - 1, to));
    if (from === to) return out;
    var it = out.splice(from, 1)[0];
    out.splice(to, 0, it);
    return out;
  }

  /* A drop gap g sits before item g (g = list.length is after the last one).
     Dropping the item from `from` into gap g lands it at this final index. */
  function dropIndex(gap, from) { return gap > from ? gap - 1 : gap; }

  /* gaps on either side of the dragged item change nothing */
  function isNoopGap(gap, from) { return gap === from || gap === from + 1; }

  /* keyboard and menu moves: 'top' | 'up' | 'down' | 'bottom'. null when nothing changes. */
  function step(len, from, kind) {
    var to = kind === 'top' ? 0 : kind === 'up' ? from - 1 : kind === 'down' ? from + 1 : kind === 'bottom' ? len - 1 : from;
    to = Math.max(0, Math.min(len - 1, to));
    return to === from ? null : to;
  }

  function idsOf(list, key) { key = key || 'id'; return list.map(function (w) { return w[key]; }); }
  function sameOrder(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

  /* reorder `list` to follow `ids` (used by Undo). Unknown ids are skipped, leftovers keep their order at the end. */
  function applyOrder(list, ids, key) {
    key = key || 'id';
    var map = {}, out = [];
    list.forEach(function (w) { map[w[key]] = w; });
    ids.forEach(function (id) { if (map[id]) { out.push(map[id]); delete map[id]; } });
    list.forEach(function (w) { if (map[w[key]]) out.push(w); });
    return out;
  }

  /* keep saved ids. Generate one only when it is missing or already used. */
  function ensureIds(items, makeId) {
    var seen = {};
    return items.map(function (it) {
      var id = it && it.id != null ? String(it.id).trim() : '';
      if (!id || seen[id]) { do { id = makeId(); } while (seen[id]); }
      seen[id] = true;
      return id;
    });
  }

  /* storage: v3 first, then the v4 editor's v2 key. v2 is only read, never rewritten. */
  function readDraft(storage) {
    var raw = null, from = null;
    try { raw = storage.getItem(KEY_V3); if (raw) from = 'v3'; } catch (e) { raw = null; }
    if (!raw) { try { raw = storage.getItem(KEY_V2); if (raw) from = 'v2'; } catch (e) { raw = null; } }
    if (!raw) return null;
    try {
      var rec = JSON.parse(raw);
      var data = rec && rec.schema === 3 && rec.data ? rec.data : rec;
      if (!data || !Array.isArray(data.items)) return null;
      return { data: data, from: from, savedAt: rec && rec.savedAt || null, dropped: rec && rec.dropped || 0 };
    } catch (e) { return null; }
  }
  function wrapDraft(data, dropped) { return { schema: 3, savedAt: new Date().toISOString(), dropped: dropped || 0, data: data }; }

  /* identical to the templates' L.parseNote + L.bucket inputs: reason is the first paragraph */
  function textStats(reason, note) {
    var text = [reason, note].filter(function (v) { return v && String(v).trim(); }).join('\n\n');
    var paras = 0, len = 0;
    String(text).replace(/\r/g, '').split(/\n{2,}/).forEach(function (b) {
      b = b.trim(); if (!b) return;
      if (b.charAt(0) === '>') return;
      paras++; len += b.length;
    });
    var bucket = !len ? 'none' : (len <= 90 && paras <= 1) ? 'line' : (len <= 260 && paras <= 2) ? 'short' : (len <= 600 && paras <= 4) ? 'medium' : 'long';
    var noteBlocks = String(note || '').replace(/\r/g, '').split(/\n{2,}/).filter(function (b) { return b.trim(); }).length;
    return { bucket: bucket, len: len, chars: String(note || '').replace(/\s/g, '').length, paras: noteBlocks };
  }

  return {
    KEY_V3: KEY_V3, KEY_V2: KEY_V2,
    move: move, dropIndex: dropIndex, isNoopGap: isNoopGap, step: step,
    idsOf: idsOf, sameOrder: sameOrder, applyOrder: applyOrder, ensureIds: ensureIds,
    readDraft: readDraft, wrapDraft: wrapDraft, textStats: textStats
  };
});
