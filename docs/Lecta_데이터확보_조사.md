# 데이터 확보 방법 조사: 매체별 소스, 사용 가능성, 저작권

- 작성: 배한준, 2026-11-10 (11/9 회의 할 일, 기한 11/14)
- 범위: 영화, 책, 음악, 콘서트, 뮤지컬, 오페라, 전시
- 앞선 문서: `docs/Lecta_피드백_리서치.md`(`feat/uat-editorial-mcp` 브랜치) 2장의 개요를 약관 원문 기준으로 다시 확인하고 고친 문서입니다.
- 표기: **확인** = 공식 약관이나 문서 원문을 직접 열어 확인함, **미확인** = 2차 자료나 추정. 법률 자문이 아니며, 수익화 전에는 전문가 검토가 필요합니다.

---

## 1. 결론

1. **일곱 매체 모두 공식 API로 확보할 수 있다.** 크롤링은 필요 없다. 국내 음원사(멜론 등), 예매처(인터파크 등), 왓챠피디아, 교보, 예스24는 쓸 수 있는 공개 API를 찾지 못했다.
2. **"담는 순간 DB에 저장"은 그대로는 안 된다.** 알라딘, 카카오, KOBIS, Google, Spotify가 영구 저장을 막고 TMDB는 캐시를 6개월로 제한한다. 영구 저장은 외부 ID와 사용자가 쓴 글만, 나머지는 기한 있는 캐시로 바꿔야 한다(3장).
3. **자유롭게 저장할 수 있는 소스는 CC0 계열뿐이다.** Wikidata, MusicBrainz 코어 데이터, Open Opus, The Met, 그리고 공공데이터(KOPIS, 문화포털, 서울시)다.
4. **이미지는 어느 소스도 권리를 넘겨주지 않는다.** 포스터, 표지, 앨범 커버는 파일을 복제하지 않고 API가 준 주소를 그대로 불러오며(핫링크), 작게 표시하고, 출처와 원 페이지 링크를 붙이고, 삭제 요청 창구를 둔다(4장).
5. **TMDB 약관이 AI 연계 이용을 금지한다.** 추천 엔진과 MCP가 TMDB 줄거리나 장르를 입력으로 쓰면 걸릴 수 있다. 추천 입력은 우리 태그와 사용자가 쓴 이유로 한정하고, 범위는 TMDB에 문의한다.
6. **기존 문서에서 바뀐 사실 세 가지.** 네이버 책 검색 API는 2026-07-31 종료(2차 자료), Spotify 개발 모드는 25명이 아니라 5명, TMDB 호출 한도는 초당 약 40회.

### 이번 주(11/14 UAT)에 붙일 소스

| 매체 | 1순위 | 키 발급 | 비고 |
| --- | --- | --- | --- |
| 영화, 시리즈 | TMDB | 즉시 | 로고와 고지문 필수 |
| 책 | 카카오 책 검색 + 알라딘 TTB | 카카오 즉시, 알라딘 미확인 | 네이버 책은 제외 |
| 음악(앨범, 곡) | MusicBrainz + Cover Art Archive | 키 없음 | 서버에서 초당 1회로 제한 |
| 콘서트, 뮤지컬, 오페라 | KOPIS | 신청 즉시 이메일 | XML, 기간 제약 실측 필요 |
| 전시 | 문화포털 한눈에보는문화정보 + 서울시 문화행사 | 자동승인 | 서울시는 공공누리 1유형 |
| 작품 단위(뮤지컬, 오페라), 매체 연결 | Wikidata, Open Opus | 키 없음 | CC0 |

---

## 2. 매체별 소스

표의 "저장"은 메타데이터를 우리 DB에 오래 두어도 되는지를 뜻합니다.

### 2.1 영화, 시리즈

| 소스 | 받을 수 있는 것 | 키와 한도 | 이용 조건 | 저장과 이미지 | 판단 |
| --- | --- | --- | --- | --- | --- |
| **TMDB** | 제목, 원제, 개봉일, 장르, 줄거리, 출연, 제작진, 포스터. 한국어 지원 | 계정에서 신청, 초당 약 40회(확인) | 비상업 무료, 상업은 별도 서면 계약. 로고와 "This product uses the TMDB API but is not endorsed or certified by TMDB." 고지 필수. **AI, ML 연계 이용 금지 조항**(1.C, 확인) | 캐시는 6개월까지(1.C, 확인). 이미지는 TMDB 주소로 핫링크 | **채택** |
| KMDb(한국영상자료원) | 한국 영화 줄거리, 포스터, 스틸 | 회원 신청, 승인 1-2일(미확인) | 공공누리 배지 있음, 유형 미확인 | 미확인 | 키만 신청해 두고 보강용 |
| KOBIS(영진위) | 박스오피스, 영화 목록과 상세. 포스터와 줄거리 없음 | 가입 후 발급 | 출처 명시, 다른 정보와 혼합 금지(확인) | **결과 복제, 저장 금지, 실시간 사용**(6조 2항, 확인) | 박스오피스 표시 용도로만 |
| OMDb | 영문 메타 | 무료 일 1,000회 | 개인적 이용 한정 | 제한적 | 쓰지 않음 |
| JustWatch, 왓챠피디아, 네이버 영화 | - | 공개 API 없음 | 왓챠피디아는 크롤링, 수집 금지 고지 | - | 불가 |

### 2.2 책

| 소스 | 받을 수 있는 것 | 키와 한도 | 이용 조건 | 저장과 이미지 | 판단 |
| --- | --- | --- | --- | --- | --- |
| **알라딘 TTB** | 제목, 저자, 출판사, 소개, 카테고리, 표지(여러 크기), 상품 링크. 국내서 품질이 가장 좋음 | 일 5,000회(안내문이 오래됨), 발급 소요 미확인 | 사전 승인 없는 영리 이용 시 키 거부 가능(6.3, 확인). 출처, 링크 의무 조항은 약관에 없음(확인) | **무단 복제, 저장(캐시 포함) 금지**(7.3 3항, 확인). 표지는 핫링크 + 상품 링크 | **채택**, 저장 범위는 알라딘에 문의 |
| **카카오 책 검색** | 제목, 저자, 출판사, 소개, ISBN, 썸네일. 카테고리 없음 | 앱 생성 즉시, 책 검색 일 30,000건(확인) | 상업 이용 가능, AI 입력 금지(데브톡 답변, 미확인) | 영구 저장 금지, 기간 캐시 후 파기는 가능(데브톡 답변, 미확인). 운영정책상 캐시는 최신 유지(확인) | **채택**(가장 빠름) |
| 네이버 책 검색 | - | **2026-07-31 종료**(여러 2차 자료 일치, 공지 원문은 직접 확인 필요) | - | - | 제외 |
| 국립중앙도서관 ISBN 서지 | 서지, KDC 분류, 일부 표지 | 담당자 승인 필요 | 미확인 | 미확인 | ISBN 정규화 보조 |
| 정보나루 | 서지, 인기 대출, 추천 | 승인 익일(미확인) | 미확인 | 미확인 | 대출 기반 추천이 필요해지면 |
| Google Books | 서지, 표지. 한국어 품질 들쭉날쭉 | Cloud 키 | "Powered by Google"과 링크 필수, 결과 재정렬 금지 | DB 구축, 영구 사본 금지(확인) | 외서 보조 |
| Open Library | 서지, 표지. 한국어 약함 | 키 없음, 초당 1-3회 | 고트래픽 상업 백엔드로 쓰지 말 것 | 덤프 제공 | 외서 보조 |
| 교보문고, 예스24 | - | 공개 API를 찾지 못함 | - | - | 불가 |

### 2.3 음악(앨범, 곡)

| 소스 | 받을 수 있는 것 | 키와 한도 | 이용 조건 | 저장과 이미지 | 판단 |
| --- | --- | --- | --- | --- | --- |
| **MusicBrainz** | 아티스트, 앨범, 곡, ISRC. 한국 아티스트 16,610건(API로 확인) | 키 없음. IP당 초당 약 1회, 연락처가 든 User-Agent 필수(확인) | 코어 데이터 CC0. 태그, 평점은 CC BY-NC-SA(비상업) | **코어는 영구 저장 가능** | **채택**(곡 단위의 기준 ID) |
| **Cover Art Archive** | 앨범 커버 250/500/1200px | 키 없음 | 이미지 권리는 각 권리자에게 있다고 명시(확인) | 주소만 저장하고 핫링크 | **채택** |
| Deezer | 곡, 앨범 검색, 커버, 30초 미리듣기. 한글 검색 동작(확인) | 검색은 키 없이 동작 | **비상업 한정**(확인) | 미리듣기 주소는 만료됨 | 한글 검색 보강용(저장하지 않음) |
| iTunes Search | 곡, 앨범 검색, 아트워크, 미리듣기 | 키 없음, 분당 약 20회 | 홍보 목적 한정, 스토어 배지 가까이 배치(확인) | 미리듣기 저장 금지 | 검색 보조 |
| Last.fm | 태그, 유사 아티스트 | 키 필요 | **비상업 전용**, 크레딧과 링크 필수, 이미지는 계약 대상 아님(확인) | 저장 100MB 상한 | 데모까지만 태그 보조 |
| YouTube Data | 영상, 썸네일, 임베드 | 일 10,000 유닛, 검색은 일 100회 | 출처 표시, 플레이어 변형 금지 | 30일 안에 갱신 또는 삭제(확인) | 듣기 임베드용 |
| Spotify Web API | 앨범, 곡, 커버 | **개발 모드 5명, Premium 필수**(2026-02, 확인). 확장은 법인 + 월 사용자 25만 | 출처 표기와 링크백, AI 학습 금지 | **무기한 저장 금지**(확인) | 쓰지 않음 |
| Apple Music API | 곡, 앨범, 아트워크 | 개발자 프로그램 연 99달러 | 아트워크를 재생과 분리해 쓸 수 없음(확인) | - | 쓰지 않음 |
| Discogs | 음반 중심 메타 | 약관 원문을 열지 못함 | 미확인 | 6시간 넘는 캐시 금지(미확인) | 보류 |
| 멜론, 지니, 벅스, FLO, 바이브, 써클차트 | - | 공개 API를 찾지 못함 | - | - | 불가 |

가사는 저장하지도 표시하지도 않습니다. 미리듣기는 음원 파일을 다루지 않고 YouTube나 Spotify의 공식 임베드 플레이어만 씁니다.

### 2.4 공연: 콘서트, 뮤지컬, 오페라

국내 공연은 **KOPIS(공연예술통합전산망, 예술경영지원센터)** 가 사실상 유일한 1차 소스입니다.

| 항목 | 내용 |
| --- | --- |
| 받을 수 있는 것 | 공연 목록과 상세(제목, 기간, 공연장, 출연진, 제작진, 제작사, 줄거리, 포스터, 소개 이미지, 예매처), 시설, 수상작, 원·창작자, 예매 순위 |
| 장르 코드(확인) | 연극 `AAAA`, 무용 `BBBC`, 대중무용 `BBBE`, 서양음악(클래식) `CCCA`, 국악 `CCCC`, **대중음악 `CCCD`**, 복합 `EEEA`, 서커스, 마술 `EEEB`, **뮤지컬 `GGGA`** |
| 오페라 | **전용 코드가 없습니다.** 클래식(`CCCA`)에 섞여 있는 것으로 보여, 제목이나 Wikidata 매칭으로 우리가 따로 표시해야 합니다 |
| 키와 한도(확인) | 신청 직후 이메일로 발급. 유효 1년, 3개월 미사용 시 취소. 초당 10회를 넘으면 중지. 일일 한도 수치는 공개되지 않음 |
| 이용 조건(확인) | 무료, 상업 이용 가능. 출처 표기 필수: `출처: (재)예술경영지원센터 공연예술통합전산망(www.kopis.or.kr)` |
| 저장 | 금지 조항 없음. 변경분만 받는 `afterdate` 파라미터가 있어 동기화를 전제한 설계로 보임 |
| 포스터 | **저작권 귀속이나 재이용 허락 조항이 없습니다.** 포스터는 제작사 저작물로 보고 핫링크와 출처 표기로 운영 |
| 응답 형식 | XML만 제공. 예시 주소가 `http://`라서 포스터를 https로 받을 수 있는지 확인 필요 |

주의할 점이 세 가지 있습니다.

- **검색 구조 위험:** 공연 목록 API는 시작일과 종료일이 필수이고, 결과 코드에 "최대 31일까지 조회 가능"이 있습니다. 공식 샘플은 6개월을 조회하고 있어 문서끼리 맞지 않습니다. 제목만으로 과거 공연 전체를 검색할 수 없다면, 하루 한 번 변경분을 받아 ID, 제목, 기간, 장르만 미리 쌓아 두는 방식으로 바꿔야 합니다.
- **작품과 공연이 다릅니다:** KOPIS의 모든 레코드는 특정 공연장과 기간의 공연(`mt20id`)이고, "레미제라블"이라는 작품 자체의 ID는 없습니다. 2.6에서 다룹니다.
- **해외 콘서트 소스는 못 씁니다:** Songkick과 Bandsintown은 학생 프로젝트에 키를 주지 않는다고 명시합니다(확인). setlist.fm은 비상업, 단기 캐시 조건으로 지난 공연 기록 보조용입니다. Ticketmaster는 한국 데이터가 빈약할 것으로 추정합니다.

### 2.5 전시

| 소스 | 받을 수 있는 것 | 키와 한도 | 이용 조건 | 판단 |
| --- | --- | --- | --- | --- |
| **문화포털 한눈에보는문화정보**(한국문화정보원) | 전국 공연, 전시, 기간, 장소, 좌표, 썸네일 | 공공데이터포털 자동승인, 개발 계정 일 10,000건(확인) | 무료, 이용허락범위 제한 없음. 응답 필드명은 첫 호출로 확인 필요 | **채택** |
| **서울시 문화행사 정보**(열린데이터광장) | 제목, 기간, 장소, 주최, 요금, 대표 이미지, 좌표 등 24개 필드. 약 19,750건, 서울만 | 키 발급 절차 미확인 | **공공누리 1유형**(출처 표시, 상업 이용과 변경 가능, 확인) | **채택** |
| 국립현대미술관 전시정보, 12개 기관 전시정보(공공데이터포털) | 전시명, 기간, 장소 | 미확인 | 제한 없음 표기 | 활용 신청 후 확인 |
| The Met Collection API | 소장품 메타, 퍼블릭 도메인 이미지 | 키 없음, 초당 80회 | CC0(확인) | 작품 이미지용 |
| Art Institute of Chicago, Europeana | 소장품 메타 | 문서 접근 실패 | 미확인 | 보류 |
| 국립중앙박물관 e뮤지엄, 아트맵, 네이버 전시, Google Arts & Culture | - | 확인하지 못함 | - | 보류 |

공공데이터의 "제한 없음"이나 공공누리 표시는 **사실 정보**에 대한 것입니다. 썸네일로 들어오는 전시 포스터는 주최 측 저작물인 경우가 많아 포스터와 같은 방식(핫링크, 출처, 삭제 대응)으로 다룹니다.

공공누리는 네 유형 모두 출처 표시가 필수이고, 2, 4유형은 상업 이용 금지, 3, 4유형은 변경 금지입니다. 수익화를 생각하면 처음부터 1유형과 CC0만 저장하고 소스별 라이선스를 DB에 남겨 두는 편이 안전합니다.

### 2.6 작품 단위와 매체 연결

"2023년 블루스퀘어 레미제라블을 봤다"와 "레미제라블을 좋아한다"는 다른 데이터입니다. 앞은 KOPIS의 공연이고, 뒤는 작품입니다.

| 소스 | 내용 | 조건 |
| --- | --- | --- |
| **Wikidata** | 작품과 프로덕션이 별도 항목. 레미제라블 뮤지컬 `Q830581`, 라 트라비아타 `Q186162`. 무대 음악 작품 16,780건 중 **한국어 이름이 있는 것은 345건**(실측). TMDB ID, ISBN, MusicBrainz ID를 서로 이어 줌 | CC0, 저장 자유 |
| **Open Opus** | 클래식 작곡가와 작품. 전체 덤프 제공. 오페라는 Stage 장르에 포함, 뮤지컬 없음 | CC0 |
| IBDB, Playbill, Operabase, 플레이DB | 공개 API를 찾지 못함 | 불가 |

제안하는 구조:

- **작품(Work):** 내부 ID, Wikidata ID(없을 수 있음), 한글, 원어 제목, 유형(뮤지컬, 오페라, 연극 등), 작곡, 원작
- **공연(Production):** KOPIS ID, 작품 ID(없을 수 있음), 기간, 공연장, 출연진, 포스터 주소
- 사용자가 공연을 담으면 제목에서 지역 표기, "내한", "앙코르", 연도를 떼어 내고 기존 작품과 맞춥니다. 없으면 Wikidata를 찾고, 그래도 없으면 우리 쪽 작품을 새로 만듭니다.
- 한국 창작 뮤지컬과 연극은 Wikidata에 거의 없습니다. 데모데이용으로 인기 작품 100-200개를 직접 넣어 두는 것이 현실적입니다.
- 콘서트나 일회성 공연은 작품 없이 공연만 둡니다.

---

## 3. 저장 설계: "담는 순간 저장"을 이렇게 바꿉니다

회의 자료의 전제는 "검색할 때 불러오고 담는 순간 저장"이었습니다. 검색할 때 불러오는 부분은 그대로 두고, 저장하는 범위만 좁힙니다.

| 계층 | 무엇을 | 얼마나 | 근거 |
| --- | --- | --- | --- |
| 영구 저장 | 소스 이름 + 외부 ID(TMDB ID, ISBN13, MBID, KOPIS ID, Wikidata ID), 사용자가 쓴 이유, 메모, 담은 날짜, 우리가 붙인 태그 | 무기한 | 사용자와 우리 데이터 |
| 영구 저장 | CC0, 공공데이터의 메타(MusicBrainz 코어, Wikidata, Open Opus, KOPIS, 문화포털, 서울시) | 무기한 | 라이선스가 허용 |
| 기한 캐시 | TMDB, 알라딘, 카카오의 제목, 창작자, 연도, 줄거리, 장르, 이미지 주소 | 소스별 만료(TMDB 6개월 미만, 카카오, 알라딘은 짧게). 만료되면 ID로 다시 조회 | 약관의 저장 제한 |
| 저장 안 함 | 이미지 파일, 음원과 미리듣기, 가사 | - | 저작권과 약관 |

- 스키마에는 `source`, `external_id`, `license`, `fetched_at`, `expires_at`이 필요합니다. 화요일 데이터 계약(`ExternalWork`)에 이 필드를 넣겠습니다.
- 제목, 창작자, 연도 같은 사실 정보는 저작물이 아니지만, 알라딘과 카카오 약관으로는 저장 제한에 걸릴 여지가 남습니다. 제목이 없으면 내 방 목록조차 그릴 수 없으므로, **제목, 창작자, 연도까지는 저장하고 알라딘에 허용 범위를 문의하는 안**을 제안합니다. 팀 결정이 필요합니다.
- 책은 ISBN으로, 영화는 Wikidata로 CC0 사실 정보를 다시 얻을 수 있어서 장기적으로는 이쪽을 영구 저장 계층으로 삼을 수 있습니다.
- 추천과 MCP의 입력은 우리 태그와 사용자가 쓴 이유로 한정합니다. TMDB 줄거리를 LLM에 넣거나 임베딩하는 것은 TMDB 약관(1.C)과 카카오의 AI 입력 금지에 걸릴 수 있습니다.

---

## 4. 저작권 이슈와 해결 방법

### 4.1 무엇이 문제인가

| 대상 | 쟁점 |
| --- | --- |
| 제목, 창작자, 연도, ISBN | 사실 정보라 저작물이 아님. 다만 API 약관은 저작권과 별개로 지켜야 함 |
| 포스터, 책 표지, 앨범 커버 | 미술, 사진 저작물. 권리자는 제작사, 배급사, 출판사, 음반사. API가 주소를 준다고 이용 허락이 생기지 않음 |
| 줄거리, 책 소개 | 어문 저작물일 수 있음. 요약해 다시 써도 원문과 실질적으로 비슷하면 침해가 될 수 있음(대법원 2011도3599, 2차 자료) |
| 가사, 음원, 미리듣기 | 저작권과 저작인접권. 직접 저장하거나 전송하면 안 됨 |
| 전시 작품 사진 | 작가 사후 70년이 지나지 않은 작품은 우리가 직접 제공할 수 없음 |
| 사용자가 올린 사진 | 작품을 꽉 채워 찍은 사진은 작품의 복제물. 미술관의 촬영 허용은 온라인 게시 허락이 아님 |

### 4.2 기댈 수 있는 법리

- **제28조(인용):** 비평, 연구 등의 목적으로 정당한 범위에서 인용할 수 있습니다. 사용자가 쓴 이유 옆에 작게 붙는 포스터는 유리하지만, 포스터만 늘어놓은 화면은 인용으로 보기 어렵습니다.
- **제35조의5(공정이용):** 목적, 저작물의 종류, 이용 비중, 시장에 미치는 영향 네 가지를 봅니다. 작은 썸네일, 식별 목적, 구매, 예매 링크로 원작 수요를 돕는다는 점이 유리합니다. 수익화하면 불리해집니다.
- **썸네일 판례:** 대법원 2005도7793은 검색용 작은 썸네일을 정당한 인용으로 봤고, 2009다76256과 2009다4343은 이미지를 자체 서버에 저장했는지를 침해 판단의 기준으로 삼으며 링크는 복제가 아니라고 봤습니다(모두 2차 자료로 확인). 검색엔진 사안이라 우리 서비스에 그대로 적용된다는 보장은 없습니다.
- **링크의 한계:** 대법원 2017도19025 전원합의체는 침해물인 줄 알면서 영리적, 계속적으로 링크하면 방조가 될 수 있다고 봤습니다(확인). 링크와 임베드는 공식 채널로 한정합니다.
- **제35조의3(부수적 복제):** 전시장 전경처럼 작품이 배경에 들어간 사진에만 기대할 수 있습니다.

### 4.3 실무 원칙

1. **이미지 파일을 복제하지 않습니다.** DB에는 주소만 두고 제공처 서버에서 불러옵니다.
2. **작게 보여 줍니다.** 식별용 썸네일 크기까지만 쓰고(TMDB w185-w342, 알라딘 Mid, CAA 250-500) 원본 확대나 다운로드는 두지 않습니다.
3. **출처와 원 페이지 링크를 붙입니다.** TMDB 로고와 고지문, 알라딘 상품 링크, KOPIS 출처 문구와 예매처 링크, 공공누리 출처.
4. **이미지마다 출처와 라이선스를 기록합니다.** 수익화 때 유형별로 한 번에 내릴 수 있습니다.
5. **권리 걱정 없는 기본 표지를 둡니다.** 뮤지컬, 오페라 작품 대표 이미지는 위키미디어 공용의 퍼블릭 도메인 이미지나 제목만 넣은 자체 카드로 합니다. 회의에서 정한 "템플릿으로 예쁘게"와도 맞습니다.
6. **가사, 음원, 미리듣기는 다루지 않습니다.** 공식 임베드 플레이어만 씁니다.
7. **사용자 업로드는 보조 수단으로만 둡니다.** 약관에 권리 보증을 넣고, 신고, 삭제 창구를 두고, 공연 중 촬영물은 받지 않습니다.
8. **삭제 요청 연락처를 푸터에 둡니다.**
9. **지금 쓰는 위키백과 이미지 99개는 정식 서비스 전에 바꿉니다.** 영화 포스터와 앨범 커버 상당수가 비자유 파일입니다.

### 4.4 수익화 전에 할 일

- TMDB 상업 계약, 알라딘 영리 이용 사전 승인
- Deezer, Last.fm, setlist.fm 제거 또는 상업 계약. MusicBrainz 상업 지원 계정(월 100달러부터)
- 공공누리 2, 4유형 자산 제거
- 포스터 재이용 범위를 KOPIS(kopis@gokams.or.kr)와 주요 제작사에 서면 문의
- 법률 검토

---

## 5. 이번 주 실행 순서

| 언제 | 할 일 |
| --- | --- |
| 화(오늘) | 키 신청: TMDB, 카카오, 알라딘 TTB, KOPIS, 공공데이터포털(문화포털 15138937), 서울 열린데이터광장, KMDb |
| 화 | 데이터 계약에 `source`, `external_id`, `license`, `fetched_at`, `expires_at` 반영 |
| 수 | TMDB와 책 어댑터. KOPIS 실측 세 가지: 제목만으로 31일 넘게 검색되는지, 가장 오래된 연도, 포스터 https 접근 |
| 목 | MusicBrainz 검색(서버 큐, 초당 1회, User-Agent)과 CAA 커버. 출처 표기 화면 |
| 이후 | 작품(Work) 시드, 전시 소스, KOPIS 동기화 방식 결정 |

## 6. 팀에서 정할 것

1. 알라딘, 카카오 책의 제목, 저자, 연도를 영구 저장할지, 기한 캐시로 둘지
2. 추천과 MCP가 외부 API의 줄거리를 읽지 않도록 할지(TMDB AI 조항)
3. 공연을 작품과 공연 두 단위로 나눌지, 이번 주에는 공연만 둘지
4. 사용자 사진 업로드를 넣을지, 넣는다면 언제

## 7. 문의하거나 직접 확인할 것

- 알라딘(ttb@aladin.co.kr): 담은 도서의 저장 허용 범위, 출처 표기 형식, 키 발급 소요
- TMDB: 추천 기능에 콘텐츠를 쓸 수 있는 범위
- 네이버 책 API 종료 공지 원문(developers.naver.com/notice/article/32564)
- KOPIS: 일일 한도, 과거 데이터 범위, 조회 기간 제약, 포스터 이용 조건
- 문화포털 응답 필드명, 서울 열린데이터광장 한도
- Discogs 약관, iTunes Search의 한국 스토어 결과, MusicBrainz의 한글 제목 품질
- 저작권법 제102-103조(온라인서비스제공자 책임 제한) 원문

---

## 출처

**영화, 책**
- [TMDB API Terms of Use](https://www.themoviedb.org/api-terms-of-use), [TMDB FAQ](https://developer.themoviedb.org/docs/faq), [TMDB Rate Limiting](https://developer.themoviedb.org/docs/rate-limiting)
- [KMDb 영화상세정보 API](https://www.kmdb.or.kr/info/api/apiDetail/6), [KOBIS Open API 약관](https://www.kobis.or.kr/kobisopenapi/homepg/board/findProvisionInfo.do)
- [알라딘 Open API 이용약관](https://blog.aladin.co.kr/openapi/13851154), [알라딘 API 안내](https://www.aladin.co.kr/ttb/apiguide.aspx)
- [카카오 Daum 검색 개발 가이드](https://developers.kakao.com/docs/ko/daum-search/dev-guide), [카카오 쿼터](https://developers.kakao.com/docs/ko/getting-started/quota), [카카오 운영정책](https://developers.kakao.com/terms/ko/site-policies), [데브톡: 캐시와 저장](https://devtalk.kakao.com/t/api/151260)
- [네이버 API HUB 개요](https://api.ncloud-docs.com/docs/naver-api-hub-overview.md), [네이버 검색 API 이관 정리(2차)](https://waffleboard.io/blog/naver-search-api-hub-migration-guide)
- [국립중앙도서관 ISBN 서지 API](https://www.nl.go.kr/NL/contents/N31101030500.do), [정보나루 API](https://www.data4library.kr/apiUtilization)
- [Google Books API Terms](https://developers.google.com/books/terms), [Google APIs Terms](https://developers.google.com/terms), [Open Library API](https://openlibrary.org/developers/api)

**음악, 콘서트**
- [MusicBrainz Data License](https://musicbrainz.org/doc/About/Data_License), [MusicBrainz Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting), [Cover Art Archive](https://coverartarchive.org/)
- [Spotify Quota Modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [Spotify 2026-02 공지](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security), [Spotify Developer Terms](https://developer.spotify.com/terms)
- [Last.fm API ToS](https://www.last.fm/api/tos), [Deezer Terms of Use](https://developers.deezer.com/termsofuse), [iTunes Search API](https://performance-partners.apple.com/search-api)
- [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies), [Apple Developer Program License Agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement)
- [Songkick Developer](https://www.songkick.com/developer), [setlist.fm API Terms](https://www.setlist.fm/help/api-terms), [Ticketmaster Terms](https://developer.ticketmaster.com/support/terms-of-use/)

**공연, 전시, 작품**
- [KOPIS Open API 안내](https://www.kopis.or.kr/por/cs/openapi/openApiInfo.do?menuId=MNU_00074), [KOPIS API 목록](https://www.kopis.or.kr/por/cs/openapi/openApiList.do?menuId=MNU_00074), [KOPIS FAQ](https://www.kopis.or.kr/por/cs/openapi/openApiFaq.do?menuId=MNU_00074)
- [한눈에보는문화정보조회서비스](https://www.data.go.kr/data/15138937/openapi.do), [문화포털 API 가이드](https://www.culture.go.kr/industry/apiGuideA.do)
- [서울시 문화행사 정보](https://data.seoul.go.kr/dataList/OA-15486/S/1/datasetView.do), [공공누리 유형](https://www.kogl.or.kr/info/license.do)
- [The Met Collection API](https://metmuseum.github.io/), [Wikidata Data access](https://www.wikidata.org/wiki/Wikidata:Data_access), [Wikimedia Commons 재이용 안내](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia), [Open Opus API](https://github.com/openopus-org/openopus_api)

**법령, 판례**
- [저작권법(국가법령정보센터)](https://www.law.go.kr/LSW/lsInfoP.do?lsId=000798)
- [대법원 2017도19025 전원합의체(한국저작권위원회)](https://www.copyright.or.kr/information-materials/trend/precedents/view.do?brdctsno=49508)
- [대법원 2009다76256(2차)](https://www.nepla.ai/case/대법원/2009다76256), [대법원 2011도3599(2차)](https://www.nepla.ai/case/대법원/2011도3599)
