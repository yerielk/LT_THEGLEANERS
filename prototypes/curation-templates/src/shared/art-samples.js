/* ==========================================================================
   Sample data for the template prototypes.
   Covers are procedurally drawn placeholders (original artwork, not real covers).
   In the product these are replaced by the real cover URL from the work record.
   ========================================================================== */
(function (root) {
  'use strict';

  function escX(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function svgUri(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function fit(len, w, max, min, sp) { return Math.max(min, Math.min(max, w / (Math.max(1, len) * (0.64 + (sp || 0))))); }
  function wrapLines(t, n) {
    var words = String(t).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else { cur = (cur + ' ' + w).trim(); }
    });
    if (cur) lines.push(cur);
    if (lines.length > 4) { lines = lines.slice(0, 4); lines[3] += '…'; }
    return lines;
  }
  function head(w, h) { return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'; }
  function lg(id, a, b, vertical) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (vertical === false ? 1 : 0) + '" y2="' + (vertical === false ? 0 : 1) + '"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>';
  }

  var ART = {
    /* film, dusk sea, two figures. 2:3 */
    sea: function (c, t) {
      var s = escX(String(t).toUpperCase()), fs = fit(s.length, 340, 34, 7, 0.28);
      return head(400, 600) + '<defs>' + lg('a', c[0], c[1]) + lg('b', c[2], c[3]) + '</defs>' +
        '<rect width="400" height="600" fill="url(#a)"/><circle cx="270" cy="338" r="74" fill="' + c[4] + '" opacity=".6"/>' +
        '<rect y="372" width="400" height="228" fill="url(#b)"/>' +
        '<rect y="384" width="400" height="2" fill="' + c[4] + '" opacity=".25"/><rect y="404" width="400" height="2" fill="' + c[4] + '" opacity=".15"/>' +
        '<g fill="' + c[3] + '"><circle cx="152" cy="446" r="17"/><rect x="130" y="460" width="44" height="76" rx="22"/><circle cx="214" cy="480" r="12"/><rect x="198" y="490" width="32" height="46" rx="16"/></g>' +
        '<text x="200" y="568" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="' + fs + '" letter-spacing="' + (fs * 0.28) + '" fill="#fff" opacity=".92">' + s + '</text></svg>';
    },
    /* film or series, night hills and a moon. 2:3 */
    night: function (c, t) {
      var s = escX(String(t).toUpperCase()), fs = fit(s.length, 340, 30, 7, 0.3);
      return head(400, 600) + '<defs>' + lg('a', c[0], c[2]) + '</defs>' +
        '<rect width="400" height="600" fill="url(#a)"/><circle cx="286" cy="150" r="48" fill="' + c[4] + '" opacity=".88"/>' +
        '<path d="M0 410 C80 350 170 372 250 402 S360 392 400 372 V600 H0Z" fill="' + c[1] + '" opacity=".92"/>' +
        '<path d="M0 500 C100 452 230 484 400 442 V600 H0Z" fill="' + c[2] + '"/>' +
        '<rect x="96" y="470" width="46" height="34" fill="' + c[2] + '"/><rect x="108" y="482" width="9" height="12" fill="' + c[4] + '"/><rect x="124" y="482" width="9" height="12" fill="' + c[3] + '"/>' +
        '<text x="200" y="566" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="600" font-size="' + fs + '" letter-spacing="' + (fs * 0.3) + '" fill="#fff" opacity=".88">' + s + '</text></svg>';
    },
    /* album, orbs. 1:1 */
    orb: function (c, t) {
      var s = escX(String(t).toUpperCase()), fs = fit(s.length, 300, 20, 11);
      return head(400, 400) + '<rect width="400" height="400" fill="' + c[0] + '"/>' +
        '<circle cx="196" cy="214" r="150" fill="' + c[1] + '"/><circle cx="268" cy="150" r="92" fill="' + c[3] + '" opacity=".92"/>' +
        '<circle cx="132" cy="262" r="46" fill="' + c[2] + '"/><path d="M60 330 A150 150 0 0 0 340 330" fill="none" stroke="' + c[4] + '" stroke-width="3" opacity=".9"/>' +
        '<text x="28" y="372" font-family="Georgia,serif" font-style="italic" font-size="' + fs + '" letter-spacing="2" fill="' + c[4] + '">' + s + '</text></svg>';
    },
    /* album, blocks. 1:1 */
    blocks: function (c, t) {
      var s = escX(String(t).toUpperCase()), fs = fit(s.length, 300, 18, 11);
      return head(400, 400) + '<rect width="400" height="400" fill="' + c[0] + '"/>' +
        '<rect width="200" height="260" fill="' + c[1] + '"/><rect x="200" width="200" height="160" fill="' + c[2] + '"/>' +
        '<rect x="200" y="160" width="200" height="240" fill="' + c[3] + '"/><rect y="260" width="200" height="140" fill="' + c[4] + '"/>' +
        '<circle cx="200" cy="200" r="64" fill="' + c[0] + '"/>' +
        '<text x="22" y="378" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="' + fs + '" letter-spacing="3" fill="' + c[0] + '">' + s + '</text></svg>';
    },
    /* book, framed typographic cover. 5:8 */
    type: function (c, t, a) {
      var lines = wrapLines(t, 11), longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
      var fs = fit(longest, 300, 46, 20), y0 = 250 - (lines.length - 1) * fs * 0.6;
      var tx = lines.map(function (l, i) { return '<text x="200" y="' + (y0 + i * fs * 1.2) + '" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="' + fs + '" fill="' + c[2] + '">' + escX(l) + '</text>'; }).join('');
      return head(400, 640) + '<rect width="400" height="640" fill="' + c[0] + '"/>' +
        '<rect x="24" y="24" width="352" height="592" fill="none" stroke="' + c[1] + '" stroke-width="2"/>' +
        '<rect x="34" y="34" width="332" height="572" fill="none" stroke="' + c[1] + '" stroke-width="1" opacity=".6"/>' + tx +
        '<circle cx="200" cy="470" r="14" fill="' + c[1] + '"/>' +
        '<text x="200" y="582" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="13" letter-spacing="4" fill="' + c[2] + '">' + escX(String(a || '').toUpperCase()) + '</text></svg>';
    },
    /* book, color band with a disc. ~2:3 */
    band: function (c, t, a) {
      var lines = wrapLines(t, 12), longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
      var fs = fit(longest, 300, 38, 18);
      var tx = lines.map(function (l, i) { return '<text x="36" y="' + (468 + i * fs * 1.2) + '" font-family="Georgia,serif" font-weight="700" font-size="' + fs + '" fill="' + c[3] + '">' + escX(l) + '</text>'; }).join('');
      return head(400, 620) + '<rect width="400" height="620" fill="' + c[2] + '"/><rect width="400" height="380" fill="' + c[0] + '"/>' +
        '<circle cx="270" cy="360" r="112" fill="' + c[1] + '"/>' + tx +
        '<text x="36" y="596" font-family="Helvetica,Arial,sans-serif" font-size="12" letter-spacing="3" fill="' + c[3] + '" opacity=".8">' + escX(String(a || '').toUpperCase()) + '</text></svg>';
    },
    /* series still. 3:4 */
    still: function (c, t) {
      var lines = wrapLines(String(t).toUpperCase(), 10), longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
      var fs = fit(longest, 300, 46, 18);
      var tx = lines.map(function (l, i) { return '<text x="30" y="' + (440 + i * fs * 1.05) + '" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="' + fs + '" fill="' + c[2] + '">' + escX(l) + '</text>'; }).join('');
      return head(390, 520) + '<defs>' + lg('a', c[0], c[1], false) + '</defs><rect width="390" height="520" fill="url(#a)"/>' +
        '<rect x="96" y="60" width="200" height="270" rx="100" fill="' + c[3] + '" opacity=".4"/><circle cx="196" cy="168" r="38" fill="' + c[2] + '" opacity=".9"/>' + tx + '</svg>';
    },
    /* landscape cover. 16:10 */
    wide: function (c, t) {
      var s = escX(String(t).toUpperCase()), fs = fit(s.length, 560 - 4 * s.length, 34, 8);
      return head(640, 400) + '<defs>' + lg('a', c[0], c[1], false) + '</defs><rect width="640" height="400" fill="url(#a)"/>' +
        '<circle cx="470" cy="170" r="84" fill="' + c[3] + '" opacity=".85"/><rect y="250" width="640" height="150" fill="' + c[2] + '" opacity=".85"/>' +
        '<text x="36" y="364" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="' + fs + '" letter-spacing="4" fill="#fff">' + s + '</text></svg>';
    },
    /* extremely tall cover. ~0.43 */
    tall: function (c, t) {
      var s = escX(String(t).toUpperCase());
      return head(300, 700) + '<rect width="300" height="700" fill="' + c[0] + '"/><rect x="0" y="0" width="100" height="700" fill="' + c[1] + '"/><rect x="200" y="0" width="100" height="700" fill="' + c[2] + '"/>' +
        '<text x="150" y="640" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="' + fit(s.length, 270, 20, 7, 0.3) + '" letter-spacing="' + (fit(s.length, 270, 20, 7, 0.3) * 0.3) + '" fill="#fff">' + s + '</text></svg>';
    },
    /* decorative photo, user supplied image stand in. 16:10 */
    photo: function (c) {
      return head(1600, 1000) + '<defs>' + lg('a', c[0], c[1]) + lg('b', c[3], c[0]) +
        '<radialGradient id="r" cx=".68" cy=".52" r=".34"><stop offset="0" stop-color="' + c[2] + '" stop-opacity=".95"/><stop offset="1" stop-color="' + c[2] + '" stop-opacity="0"/></radialGradient></defs>' +
        '<rect width="1600" height="1000" fill="url(#a)"/><rect width="1600" height="1000" fill="url(#r)"/>' +
        '<rect y="560" width="1600" height="440" fill="url(#b)"/><rect y="590" width="1600" height="3" fill="' + c[2] + '" opacity=".25"/><rect y="640" width="1600" height="3" fill="' + c[2] + '" opacity=".12"/></svg>';
    }
  };

  var LONG = '문장 하나가 오래 남는 이유는 대개 그 문장이 쓰인 방식 때문이 아니라, 그것을 읽던 때의 내가 어디에 있었는지 때문이다. 같은 작품을 다른 시간에 다시 보면 다른 장면이 먼저 떠오른다. ';
  function long(n) { var s = ''; for (var i = 0; i < n; i++) s += LONG; return s.trim(); }

  function W(id, medium, title, creator, year, kind, colors, note, extra) {
    var o = { id: id, medium: medium, title: title, creator: creator, year: year, art: { kind: kind, colors: colors }, note: note || '' };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  var SETS = {
    A: {
      label: 'A  이야기가 끝난 뒤 (붉은 계열 포함 8편)',
      ex: {
        title: 'After the Last Scene',
        subtitle: '기억과, 잃은 사람과, 이야기가 끝난 뒤에 남는 것에 대한 여덟 편',
        curator: '예은',
        intro: '한 장면이 끝나도 우리는 그 방에 한참 서 있습니다. 이 큐레이션은 떠난 사람과 떠난 시간을 오래 바라보게 만든 작품들을 모았습니다. 순서대로 걸어도 되고, 마음 가는 방부터 들어가도 됩니다.',
        heroId: 'a3',
        items: [
          W('a1', 'film', 'Aftersun', 'Charlotte Wells', 2022, 'sea', ['#2F5D8A', '#E0875A', '#1F3F63', '#0F2540', '#F2B27A'],
            '영화가 끝나도 끝나지 않는 장면이 있다. 이 영화에서 나는 아버지의 뒷모습을 오래 보았다.\n\n> 기억은 사진보다 느리게 도착한다.\n\n그날의 햇빛과 호텔 수영장, 캠코더 속의 얼굴이 한꺼번에 떠오르는 순간까지, 영화는 아무것도 설명하지 않고 기다려 준다. 그 기다림이 이 전시의 첫 장면이다.',
            { featured: true, scenes: [{ kind: 'photo', colors: ['#233B63', '#E58B5E', '#F6C58F', '#10233F'], caption: '수영장 장면' }, { kind: 'photo', colors: ['#1B2F4F', '#C97A55', '#E8B98A', '#0B1A30'], caption: '캠코더 속 마지막 날' }] }),
          W('a2', 'album', 'Carrie & Lowell', 'Sufjan Stevens', 2015, 'blocks', ['#3E5A74', '#8FA3A6', '#2B3948', '#C7D2D0', '#1B2430'],
            '기타 한 대와 낮은 목소리만으로, 떠난 사람에게 말을 거는 방법을 알려 주는 앨범. 듣고 나면 방 안의 공기가 조금 달라져 있다. 가사를 몰라도 슬픔의 온도는 정확히 전해진다.'),
          W('a3', 'book', 'The Years', 'Annie Ernaux', 2008, 'type', ['#9E2B25', '#E6E2DC', '#F4F0EA', '#6E1A17'],
            '한 사람의 기억이 한 세대의 기록이 되는 방식을, 나는 이 책에서 처음 배웠다.'),
          W('a4', 'album', 'Pink Moon', 'Nick Drake', 1972, 'orb', ['#173F3A', '#E8873A', '#0B1F1D', '#5FA39A', '#F2C36B'], ''),
          W('a5', 'film', 'Past Lives', 'Celine Song', 2023, 'night', ['#2B2350', '#8A5CA8', '#141029', '#E6A0B8', '#F5D0A0'],
            '스쳐 지나간 사람을 다시 만난다는 건, 그 사람을 만나는 일이기보다 그때의 나를 다시 만나는 일에 가깝다. 영화는 두 사람이 서로를 바라보는 몇 장면에 대부분의 시간을 쓰고, 나머지는 말하지 않는다. 말하지 않는 것이 이 영화의 가장 큰 문장이다.\n\n나영이 어릴 적 살던 동네의 골목을 떠올리는 장면에서 오래 멈춰 있었다. 이민이라는 사건이 한 사람의 이름을 둘로 나누고, 그 둘이 서로를 모른 채 한 몸에 산다는 것. 그 둘을 다 이해해 주는 사람이 이 세상에 한 명이라도 있다면 얼마나 다행일까. 영화는 그 사람이 누구인지 끝까지 정하지 않는다.\n\n> 우리가 스친 건 아주 짧은 시간이었지만, 그 시간은 아직 어딘가에 남아 있다.\n\n마지막 택시 장면은 몇 번을 다시 봐도 같은 자리에서 숨이 막힌다. 이별은 대부분 큰 소리를 내지 않고, 그래서 더 오래 남는다. 엔딩 크레딧이 올라가는 동안 극장 안의 사람들이 아무도 일어나지 않았다. 그 침묵이 이 영화에 대한 가장 정확한 감상문이었다고 생각한다. 이 큐레이션의 방들 중 가장 조용한 방을 이 영화에게 주고 싶었다.\n\n개봉하고 한참 뒤에야 이 영화를 봤다. 그사이 나는 이 영화에 대한 말을 너무 많이 들어서 오히려 조심스러웠는데, 막상 보고 나니 말들이 전부 영화 바깥에 있었다. 영화 안에는 두 사람과 침묵이 있을 뿐이었다.'),
          W('a6', 'book', '작별하지 않는다', '한강', 2021, 'type', ['#DCE5EB', '#7E96A8', '#22313F', '#9FB4C2'],
            '눈이 내리는 장면을 읽을 때마다 책장 넘기는 속도가 느려졌다. 이 소설은 애도가 끝나지 않는 사람이 어떻게 계속 걸어가는지를 보여 준다. 읽는 동안 추운 방에서 촛불 하나를 사이에 두고 누군가와 마주 앉아 있는 기분이었다. 슬픔을 설명하지 않고 풍경으로 건네는 문장들 덕분에, 이 책은 읽는 사람의 기억까지 같이 불러낸다.'),
          W('a7', 'album', 'Blonde', 'Frank Ocean', 2016, 'blocks', ['#1B1B1D', '#E0485A', '#F0B0B8', '#3A3A40', '#7A2B3A'],
            '이별한 뒤에 듣는 Frank Ocean은 다르다. 노래가 끝나도 그 공기가 방 안에 남아 있다. 가장 사적인 소리가 가장 멀리 간다는 걸 이 앨범으로 알았다.'),
          W('a8', 'series', 'Fleabag', 'Phoebe Waller-Bridge', 2016, 'still', ['#C9304A', '#1A1216', '#F2B8C0', '#7A1A2A'],
            '웃다가 갑자기 아픈 드라마. 카메라를 향해 던지는 농담이 사실은 가장 솔직한 고백이라는 걸 마지막 화에서야 알게 된다.\n\n> 웃기다가, 갑자기 아프다.')
        ]
      }
    },
    B: {
      label: 'B  푸른 시간 (차가운 계열 7편)',
      ex: {
        title: 'Blue Hour',
        subtitle: '해가 지고 밤이 오기 전, 모든 것이 푸르게 가라앉는 시간에 보고 읽고 들은 것',
        curator: '민재',
        intro: '',
        heroId: 'b5',
        items: [
          W('b1', 'film', 'Lost in Translation', 'Sofia Coppola', 2003, 'night', ['#1B2A4A', '#3B5C99', '#0D1526', '#7FA6D9', '#C9DDF5'],
            '말이 통하지 않는 도시에서 말이 통하는 단 한 사람을 만나는 이야기. 새벽의 호텔 로비와 네온이 번진 택시 창이 오래 남았다. 마지막 귓속말은 끝내 들리지 않아서 더 좋다.'),
          W('b2', 'album', 'Blue', 'Joni Mitchell', 1971, 'orb', ['#16355E', '#2F6CB5', '#0C1E3A', '#8DB6E8', '#D4E6FA'],
            '가장 낮은 온도로 가장 깊이 찌르는 노래들.'),
          W('b3', 'book', 'Norwegian Wood', 'Haruki Murakami', 1987, 'type', ['#1F4E52', '#7FB5B0', '#E8F1EF', '#12302F'],
            '스무 살 무렵의 쓸쓸함을 이렇게 정확하게 적은 책은 드물다. 읽는 내내 비가 내렸고, 책을 덮고 나서도 한동안 우산을 펴지 않았다.\n\n> 죽음은 삶의 반대편이 아니라 그 일부로서 존재한다.\n\n그 문장을 몇 번이나 소리 내어 읽었다.', { featured: false }),
          W('b4', 'album', 'For Emma, Forever Ago', 'Bon Iver', 2007, 'blocks', ['#34506B', '#9CB4C8', '#5B7893', '#DCE7F0', '#1F3246'], ''),
          W('b5', 'film', 'Chungking Express', 'Wong Kar-wai', 1994, 'night', ['#0F3B45', '#1F7A7A', '#06191F', '#F06A8A', '#9FE0D8'],
            '유통기한이 있는 사랑에 대한 영화. 두 번째 이야기에서 흘러나오는 노래를 지금도 같은 속도로 따라 걷는다. 도시의 새벽이 이렇게 다정할 수 있다는 걸 이 영화가 알려 줬다.',
            { featured: true, photo: { kind: 'photo', colors: ['#0B2E38', '#1E7B80', '#F06A8A', '#041216'] } }),
          W('b6', 'book', 'Never Let Me Go', 'Kazuo Ishiguro', 2005, 'band', ['#3B4A68', '#A9B8D6', '#232C42', '#EEF2FA'],
            '아주 조용한 목소리로 아주 잔인한 이야기를 하는 소설. 읽는 사람이 먼저 알아채게 만든다는 점에서 가장 정직하다.'),
          W('b7', 'series', 'Normal People', 'Lenny Abrahamson', 2020, 'still', ['#2A4B8D', '#0E1B3A', '#CFE0FA', '#6F8FD0'],
            '대사보다 침묵이 많은 연애 드라마. 같은 방에 있는 두 사람 사이의 거리를 이렇게 오래 찍어도 지루하지 않다.')
        ]
      }
    },
    C: {
      label: 'C  흑백 (색이 없는 6편, 단색 대응 확인)',
      ex: {
        title: 'Grayscale',
        subtitle: '색이 없어서 더 선명하게 남은 것들',
        curator: '지안',
        intro: '컬러를 빼고 나면 구도와 빛과 침묵이 남습니다. 오래 기억에 남은 흑백의 작품들입니다.',
        heroId: 'c1',
        items: [
          W('c1', 'film', 'Ida', 'Paweł Pawlikowski', 2013, 'night', ['#222222', '#555555', '#0E0E0E', '#BDBDBD', '#EDEDED'],
            '화면의 아래쪽 절반을 비워 두는 구도가 이야기의 무게를 대신 말해 준다. 흑백이 아니었다면 이렇게 조용할 수 없었을 것이다.\n\n> 비어 있는 곳이 가장 많은 것을 말한다.', { featured: true, photo: { kind: 'photo', colors: ['#2B2B2B', '#8A8A8A', '#E4E4E4', '#0F0F0F'] } }),
          W('c2', 'album', 'Kind of Blue', 'Miles Davis', 1959, 'orb', ['#1C1C1C', '#4A4A4A', '#8E8E8E', '#D0D0D0', '#F2F2F2'], '말 없이 오래 듣는 법을 알려 준 앨범.'),
          W('c3', 'book', 'The Stranger', 'Albert Camus', 1942, 'type', ['#D7D7D7', '#6C6C6C', '#1B1B1B', '#9A9A9A'],
            '감정을 설명하지 않는 문장이 감정을 가장 크게 만든다는 걸 처음 알았다. 읽고 나서 햇빛이 조금 무서워졌다.'),
          W('c4', 'album', 'Unknown Pleasures', 'Joy Division', 1979, 'blocks', ['#101010', '#2C2C2C', '#5E5E5E', '#9C9C9C', '#F0F0F0'], ''),
          W('c5', 'film', 'Stalker', 'Andrei Tarkovsky', 1979, 'sea', ['#303030', '#7A7A7A', '#1E1E1E', '#0C0C0C', '#CFCFCF'],
            '세 시간 동안 물과 풀과 사람의 뒷모습만 본다. 그런데도 지나가는 시간이 아깝지 않고, 끝나면 오래 말을 잃는다.'),
          W('c6', 'book', "Giovanni's Room", 'James Baldwin', 1956, 'band', ['#2E2E2E', '#8C8C8C', '#141414', '#E6E6E6'],
            '한 번의 선택이 한 사람의 방을 닫아 버린다. 문장이 아름다워서 더 아프다.')
        ]
      }
    },
    D: {
      label: 'D  스트레스 테스트 (긴 제목, 빈 값, 노란 표지, 특수문자 12편)',
      ex: {
        title: 'A Collection of Things I Could Not Stop Thinking About for an Entire Year',
        subtitle: '',
        curator: '',
        intro: '',
        heroId: 'd4',
        items: [
          W('d1', 'film', 'The Unbearable Lightness of Being and Other Very Long Titles That Test Wrapping', 'Sample Creator With A Very Long Credit Name', 1988, 'type', ['#E9D8A6', '#BB9457', '#3A2E1C', '#8A6D2A'],
            long(5)),
          W('d2', 'book', '아주아주 긴 한국어 제목이 줄바꿈과 균형을 어떻게 처리하는지 확인하기 위한 작품명', '이름이 아주 긴 작가 이름입니다', '', 'band', ['#D9A21B', '#111111', '#F2C94C', '#111111'], ''),
          W('d3', 'album', 'No Cover Available', 'Unknown', 2011, 'orb', ['#000000', '#000000', '#000000', '#000000', '#000000'], '표지 이미지가 없는 작품도 같은 품질로 보여야 합니다.', { noCover: true }),
          W('d4', 'film', 'Landscape Cover Test', 'Wide Format', 2019, 'wide', ['#17324D', '#3E7CB1', '#0B1A2A', '#F2A65A'], '가로로 긴 표지는 잘리지 않고 그대로 놓여야 합니다. 비율이 달라도 같은 크기의 판 위에서 균형이 맞는지 확인합니다.', { featured: true }),
          W('d5', 'book', 'Very Tall Cover', 'Tall Format', 2020, 'tall', ['#2B2B3B', '#C74B50', '#E8E8F0'], '세로로 아주 긴 표지. 화면 높이를 넘지 않는지 확인합니다. 한 문단이 조금 길어졌을 때 본문과 표지가 어떻게 어울리는지도 같이 봅니다. 문장은 몇 줄 더 이어질 수 있습니다.'),
          W('d6', 'film', '<img src=x onerror=alert(1)> & "quotes"', '', 2000, 'sea', ['#444444', '#aaaaaa', '#222222', '#111111', '#eeeeee'], '**굵게**와 *기울임*과 <script>alert(1)<\/script> 같은 문자열이 그대로 글자로 보여야 합니다.'),
          W('d7', 'album', '🌙 Moon', 'Artist', 2023, 'orb', ['#1B1340', '#6A4CFF', '#2A1F66', '#C9B8FF', '#FFFFFF'], '한 줄짜리 이유가 한 장을 혼자 채울 수 있는지 확인합니다.'),
          W('d8', 'series', 'Neon', 'Saturated', 2024, 'still', ['#00F5D4', '#F15BB5', '#111111', '#FEE440'],
            '> Only a quote and nothing else.'),
          W('d9', 'film', 'Featured With Photo', 'Photographer', 2021, 'sea', ['#2D5F7C', '#F0A875', '#1B3D52', '#0E2433', '#FFD9B0'], '직접 올린 사진이 있으면 화면을 가득 채웁니다.',
            { featured: true, photo: { kind: 'photo', colors: ['#2D5F7C', '#F0A875', '#FFD9B0', '#0E2433'] } }),
          W('d10', 'book', 'Short', 'A', 1999, 'type', ['#294D3A', '#98C1A6', '#F2F7F3', '#183024'], '짧다.'),
          W('d11', 'series', 'Eleven', 'Creator Eleven', 2022, 'night', ['#4A1F3D', '#9C3F7C', '#240F1E', '#F5A3CF', '#FFD6EA'], long(2) + '\n\n> 중간에 끼어 있는 인용문도 같은 규칙으로 처리됩니다.\n\n' + long(1)),
          W('d12', 'album', 'Twelve', 'Creator Twelve', 2018, 'blocks', ['#0F2F2B', '#2A9D8F', '#E9C46A', '#F4A261', '#264653'], '')
        ]
      }
    }
  };

  root.LectaSamples = { SETS: SETS, ART: ART, svgUri: svgUri, long: long };
})(window);
