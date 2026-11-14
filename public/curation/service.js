/* Service adapter for the approved v5 editor. No prototype drafts or sample works enter the service. */
(function () {
  'use strict';
  var active = /[?&]service=1/.test(location.search), hooks, initialized = false;
  var id = null, version = 0, pending = null, running = false, stopped = false, lastSaved = '', saving = null;
  var requestId = 'editor_' + crypto.randomUUID().replace(/-/g, '');
  var dirty = false, uploadCount = 0, searchTimer, readyTimer;

  async function api(url, options) {
    var response = await fetch(url, options), body = await response.json();
    if (!response.ok) { var error = new Error(body.error && body.error.message || '요청에 실패했어요. 다시 시도해 주세요.'); error.status = response.status; throw error; }
    return body;
  }
  function body(data) { return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }; }
  function fingerprint(document) { var copy = Object.assign({}, document); delete copy.focus; return JSON.stringify(copy); }
  function notifySaved() {
    hooks.saved(id);
    parent.postMessage({ type: 'lecta:editor:saved', id: id }, location.origin);
  }
  async function ensureDraft(document) {
    if (id) return;
    if (!saving) saving = api('/api/curations', body({ document: document, requestId: requestId })).then(function (result) {
      id = result.id; version = result.version; lastSaved = fingerprint(document); notifySaved();
    }).finally(function () { saving = null; });
    await saving;
  }
  async function drain() {
    if (running || stopped || !initialized) return;
    running = true;
    try {
      while (pending && !stopped) {
        var document = pending; pending = null;
        var snapshot = fingerprint(document);
        if (snapshot === lastSaved) { dirty = false; continue; }
        hooks.setStatus('Saving…');
        await ensureDraft(document);
        if (snapshot !== lastSaved) {
          var options = body({ document: document, expectedVersion: version }); options.method = 'PATCH';
          var result = await api('/api/curations/' + id, options);
          version = result.version; lastSaved = snapshot; notifySaved();
        }
        dirty = !!pending || fingerprint(hooks.getData()) !== snapshot;
        hooks.setStatus(dirty ? 'Editing' : 'Saved ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (error) {
      dirty = true;
      if (error.status === 409) stopped = true;
      hooks.setStatus(error.status === 409 ? '다른 창에서 수정됨' : '저장 실패 / Save로 재시도', true, error.message);
      hooks.toast(error.message);
    } finally { running = false; }
  }
  function work(work) {
    return { id: work.id, title: work.title, creator: work.creator, year: work.releaseYear == null ? '' : String(work.releaseYear), medium: work.medium.toLowerCase(),
      cover: work.artwork ? { src: work.artwork.url } : null, scenes: [], reason: '', note: '', layout: '', featured: false, palette: null };
  }
  window.LectaService = {
    connect: function (callbacks) {
      if (!active) return;
      hooks = callbacks;
      window.addEventListener('message', function (event) {
        if (initialized || event.source !== parent || event.origin !== location.origin || !event.data || event.data.type !== 'lecta:editor:init') return;
        id = event.data.id || null; version = event.data.version || 1;
        initialized = true;
        clearInterval(readyTimer);
        if (id) lastSaved = fingerprint(event.data.document);
        hooks.initialize(event.data.document);
        if (id) hooks.saved(id);
      });
      parent.postMessage({ type: 'lecta:editor:ready' }, location.origin);
      // Static iframe scripts can finish before React hydrates the parent listener.
      readyTimer = setInterval(function () { if (!initialized) parent.postMessage({ type: 'lecta:editor:ready' }, location.origin); }, 250);
      window.addEventListener('beforeunload', function (event) {
        if (dirty || running || uploadCount || pending || (initialized && fingerprint(hooks.getData()) !== lastSaved)) { event.preventDefault(); event.returnValue = ''; }
      });
      // A palette may finish loading after the initial autosave. Save flushes the latest document.
      document.addEventListener('input', function () { dirty = true; }, { passive: true });
    },
    save: function (document, manual) {
      if (!initialized) return;
      if (stopped) { if (manual) hooks.toast('다른 창의 변경을 보호하기 위해 저장을 멈췄어요. JSON을 내려받고 새로고침해 주세요.'); return; }
      pending = JSON.parse(JSON.stringify(document));
      dirty = fingerprint(pending) !== lastSaved;
      if (manual && !dirty && !running) hooks.toast('저장되어 있어요.');
      drain();
    },
    upload: async function (file) {
      if (!initialized || stopped) throw new Error('편집기를 다시 열어 주세요.');
      if (file.size > 8 * 1024 * 1024) throw new Error('이미지는 8MB 이하로 올려 주세요.');
      uploadCount++;
      try {
        await ensureDraft(hooks.getData());
        return await api('/api/curations/' + id + '/assets', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file });
      } finally { uploadCount--; }
    },
    search: function (q) {
      // Debounce API calls while retaining a distinct promise for each UI generation.
      clearTimeout(searchTimer);
      return new Promise(function (resolve, reject) {
        searchTimer = setTimeout(async function () {
          try {
            var result = await api('/api/works?' + new URLSearchParams({ q: q || '', limit: '40' }));
            var items = result.works.map(work);
            if (q.trim().length >= 2) {
              try {
                var external = await api('/api/external/search?' + new URLSearchParams({ q: q.trim(), limit: '4' }));
                external.works.forEach(function (w) { var item = work(w); item.id = w.source + ':' + w.externalId; item.external = { source: w.source, externalId: w.externalId, medium: w.medium, title: w.title }; items.push(item); });
              } catch (_) { /* Internal search remains available if external providers fail. */ }
            }
            resolve(items);
          } catch (error) { reject(error); }
        }, q ? 400 : 0);
      });
    },
    saveExternal: async function (external) { return work((await api('/api/external/works', body(external))).work); }
  };
})();
