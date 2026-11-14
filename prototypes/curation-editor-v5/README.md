# Lecta Curation Editor v5

v4 `curation-editor.html`을 바탕으로 편집 도구를 새로 만든 독립 HTML 프로토타입이다. 원본 v4는 덮어쓰지 않았다(`v4-original/`에 그대로 보관).

## 파일

| 파일 | 내용 |
|---|---|
| `curation-editor-v5.html` | v5 편집기. 단독 파일이며 외부 의존은 폰트 CDN뿐이다 |
| `lecta-sequence.js` | DOM이 없는 순수 함수: 순서 변경, 안정적 ID 보정, v3/v2 임시저장 읽기, 길이 구간. React로 옮길 때 dnd-kit UI만 바꾸고 이 파일은 그대로 쓴다 |
| `the-spread.html` | 원본 그대로 |
| `the-edit.html`, `afterimage.html` | `the-edit_1.html`, `afterimage_1.html`을 핸드오프에 적힌 이름으로 복사한 것. 내용은 바꾸지 않았다 |
| `v4-original/` | 받은 원본 5개 파일 (변경 없음) |
| `qa/e2e.cjs` | Playwright 종단 테스트 119개 항목 |
| `qa/sequence-check.cjs` | `lecta-sequence.js` 단위 검사 |
| `qa/e2e-results.json`, `qa/screenshots/` | 마지막 실행 결과와 스크린샷 |
| `package.json` | Node가 이 폴더의 스크립트를 CommonJS로 읽게 하는 표시만 있다(루트가 `"type":"module"`이라서) |

## 실행

편집기는 템플릿을 iframe으로 불러오므로 정적 서버가 필요하다.

```bash
python3 -m http.server 8791 --bind 127.0.0.1 --directory prototypes/curation-editor-v5
```

`http://localhost:8791/curation-editor-v5.html` (샘플에서 새로 시작하려면 `?fresh=1`).
저장소 루트의 `.claude/launch.json`에도 같은 설정(`lecta-editor-v5`)을 넣어 두었다.

## 바뀐 구조

```
Lecta / My rooms / 제목               Saved 12:18   Preview   More   [Save]
SEQUENCE (240)   | Write  Design  Preview          | DETAILS (288, Design에서만)
00 Cover         |                                 |
⋮⋮ 01 Aftersun   |  01  영화  Charlotte Wells      |  Layout / Scenes / Emphasis
⋮⋮ 02 ...        |  Aftersun                       |  Writing 요약 / Work 정보
+ Add a work     |  WHY THIS WORK ____________     |
                 |  WRITING          B  I  Quote   |
                 |  (60vh 이상의 본문 지면)        |
```

- **Write**: 가운데에 최대 720px 글쓰기 지면. 제목, 밑줄형 한 줄 `Why this work`, 본문 `Writing`(마루부리 18px, 줄 간격 1.9, 높이가 글에 맞춰 늘어나 페이지가 스크롤됨). Details는 접힌다. 커버를 고르면 큐레이션 제목, 부제, 큐레이터, 소개를 쓴다.
- **Design**: v4의 실시간 iframe 미리보기와 오른쪽 Details(구성 6종, 장면, 강조, 작품 정보, 삭제). 커버에서는 템플릿 3행 선택과 벽 색.
- **Preview**: 상단 바와 패널을 걷어내고 템플릿을 실제 너비로 띄운다. Desktop/Mobile 전환, Esc로 이전 모드 복귀.
- **Focus** (Write 전용): 상단 바, Sequence, 탭을 숨기고 글만 남긴다. 오른쪽 위에 저장 상태와 글자 수만 남는다. Esc 또는 Exit focus로 복귀.
- **More 메뉴**: Open preview in new window, Download JSON, Undo, Add a work. 실제로 동작하는 항목만 넣었다.
- 좁은 화면: 1100px 미만에서는 Details가 오른쪽 서랍, 860px 미만에서는 Sequence도 왼쪽 서랍이 된다(작업 영역을 가리지 않도록 상시 노출하지 않음).

### 시각 언어
- 편집기 chrome의 `border-radius`는 전부 0. 알약 버튼, 회색 박스 입력, 둥근 칩, 그림자를 없앴다. 버튼은 텍스트 버튼과 Save 하나의 검정 박스뿐이다.
- 입력은 밑줄형, 구분은 1px 선. 선택된 행은 옅은 중성 배경과 제목 밑줄로 표시한다(어두운 카드 대신).
- 배경 #FFFFFF / #F7F8F9 / #EEF0F2, 글자 #14171C. 누리끼리한 색, 그라데이션, 장식 막대, 가운뎃점 없음.
- 템플릿 내부(THE SPREAD의 타원 태그 등)는 손대지 않았다.

## P0 / P1 완료 여부

| 항목 | 상태 |
|---|---|
| 위아래 버튼 제거, 6점 핸들 드래그 | 완료. 마우스, 펜, 터치 모두 Pointer Events. 핸들에서만 시작(`touch-action:none`은 핸들에만) |
| 드래그 표시 | 원래 행 흐림, 2px 가로선, 아래 행 6px만 밀림, 제목만 쓴 얇은 고스트(그림자 없음) |
| 드롭 처리 | `S.works`를 ID 순서로 바꾸고 Sequence, 미리보기(`lecta:curation`, focus는 선택한 작품의 새 위치), 자동 저장. 같은 자리에 놓으면 렌더링, 저장 모두 없음 |
| Cover 고정, 선택 유지 | 완료. 드래그 중에도 Write/Details는 그대로, 번호만 갱신 |
| 키보드, 메뉴 대안 | 핸들에서 Space로 들고 화살표, Home/End로 자리 고르고 Space로 놓기, Esc 취소. Alt+↑/↓ 한 칸 이동. 행의 `⋯` 메뉴: 맨 위로, 한 칸 앞으로, 한 칸 뒤로, 맨 아래로 (불가능한 항목은 비활성) |
| 자동 스크롤, 취소, Undo | 레일 가장자리 48px에서 자동 스크롤. Esc, pointercancel 시 취소. 토스트 Undo, More의 Undo, 텍스트 밖에서 ⌘Z/Ctrl+Z |
| 안정적 ID | v4의 `load()`는 매번 `newWork()`로 새 uid를 만들었다. v5는 저장된 `id`를 그대로 쓰고, 비었거나 겹칠 때만 새로 만든다. `getData()`의 모양은 v4와 같다(장면에 `ar`만 덧붙임) |
| Write 모드 장문 글쓰기 | 완료. 입력할 때 해당 필드를 다시 그리지 않는다. 미리보기 동기화는 Write에서 700ms, Design에서 260ms debounce |
| B / I / Quote | 상단 고정(sticky) 도구 행과 ⌘B/⌘I. `execCommand('insertText')`로 넣어 브라우저의 Undo/Redo 기록과 IME 상태를 유지한다(실패 시 `setRangeText`). Quote는 여러 줄 각각에 `> `를 붙이고 앞뒤에 빈 줄을 넣어 기존 파서가 하나의 인용 블록으로 읽게 한다 |
| 캐럿 복귀 | 작품마다 포커스 필드, 선택 범위, 스크롤 위치를 기억해 Write로 돌아오면 복원 |
| 글자 수, 길이 구간 | 상단에 `1,722자 12문단`, 본문 아래 템플릿과 같은 계산의 길이 구간 안내. 제한 없음 |
| reason/note 중복 저장 없음 | reason과 note를 각각 한 번만 저장. 합치는 일은 템플릿의 `normalizeItem`이 한다 |
| 직각형 에디토리얼 UI | 완료 (테스트 11.2: 모든 화면 상태에서 둥근 모서리 요소 0개) |
| Add 대화상자 | 네이티브 `<dialog>` 모달: 배경 비활성, Esc 닫기, 여는 버튼으로 포커스 복귀, 직각, 넓은 목록 |
| 장면 썸네일 | 둥근 모서리 제거, `object-fit:contain`으로 원본 비율 유지, 앞으로/뒤로/삭제는 텍스트 버튼 |
| 템플릿 선택 | 얇은 도식 + 이름 + 한 줄 설명의 3행 |
| 저장 | `lecta.curation.draft.v3`(`{schema:3, savedAt, dropped, data}`)에 쓴다. v3가 없으면 v2를 읽되 v2는 고치지 않는다. `?fresh=1`은 샘플에서 시작 |
| 용량 초과 | 올린 래스터 이미지만 빼고 글과 구성을 저장한 뒤, 상단 상태를 경고색 `Saved without N images`로 바꾸고 토스트와 Details 장면 섹션에 안내 |
| postMessage | 메시지 타입과 payload는 v4 그대로. 편집기에서 보낼 때는 `'*'` 대신 같은 origin으로 보내고, 받을 때 origin을 확인한다(`file://`일 때만 `'*'`) |

## 브라우저 테스트

Playwright 1.58 + Chromium 156 headless, `qa/e2e.cjs`. **119 / 119 통과, 편집기와 템플릿 iframe 콘솔 오류 0, alert 0.**

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 마우스 드래그로 A,B,C → C,A,B. Sequence 번호, `getData().items`, iframe의 `Lecta.last.items`, 저장 후 다시 열기까지 순서와 ID 일치. 선택 작품과 Write 화면 유지 | 통과 |
| 2 | 같은 자리 드롭 시 저장 0회, 드래그 중 Esc 취소, Cover에 핸들 없음, 행 본문 드래그로는 순서가 안 바뀜, ⌘Z와 토스트 Undo | 통과 |
| 3 | 키보드 들기/옮기기/놓기/취소, Alt+화살표, 행 메뉴, 작품 23개에서 자동 스크롤 | 통과 |
| 4 | iPhone 13(390px) 터치: 핸들 드래그는 순서 변경, 행 본문 스와이프는 변경 없음. 서랍, Design, Details, Preview | 통과 |
| 5 | 한글 IME 조합(CDP `imeSetComposition`), 2,000자 이상 장문, 빈 줄 유지, 선택 B와 I, 브라우저 Undo/Redo, 여러 줄 인용, 템플릿 파서가 인용 2개와 문단 7개 이상을 읽음, 미리보기 반영, `long` 구간 | 통과 |
| 6 | Write → Design → Preview → 템플릿 2회 전환 → Write 후 캐럿 `123-130` 그대로 복원, Focus 진입/Esc | 통과 |
| 7 | 세로 사진 업로드, 비율 유지, 저장 후 다시 열면 ID, 순서, 제목, 이유, 본문, 장면, 캡션, 템플릿, 팔레트가 같음. JSON export 동일. 용량 초과 안내 | 통과 |
| 8 | v2 임시저장 열기(ID 유지, 중복/누락 ID 보정), v2는 그대로, v3 기록 | 통과 |
| 9 | 3개 템플릿 × 샘플 A~D 12회 렌더링: 작품 수, 플래너 결과 수 일치, 가로 넘침 0, D의 `<script>`, `<img onerror>`는 글자로만 보임 | 통과 |
| 10 | 1440×900, 1280×800, 1024×768, 390×844에서 Write/Design/Preview: 가로 스크롤 0, 패널 겹침 0, 글쓰기 컬럼이 화면 안에 있음 | 통과 |
| 11 | 둥근 모서리 0, aria-selected 탭, 핸들 aria-label, 대화상자 포커스 복귀, 'exhibition' 0건, 가운뎃점과 불릿 0건 | 통과 |

테스트하면서 고친 실제 버그: 레일이 `display:none`일 때 그리드가 작업 영역을 0px 칸으로 밀던 문제, Write 중 화면 밖 미리보기의 `scrollIntoView`가 부모 작업 영역을 옆으로 스크롤하던 문제(390px에서 글이 화면 밖으로 밀림), `focusout` 안에서 캐럿을 못 읽던 문제, 1024~1280px에서 화면 밖 미리보기가 페이지 폭을 늘리던 문제.

스크린샷: `qa/screenshots/v5-1440-write.png`, `v5-1440-design.png`, `v5-1440-preview.png`, `focus-1440.png`, `v5-1440-add-dialog.png`, `drag-many-1440.png`, `v5-1024-*.png`, `v5-390-*.png`, `mobile-390-*.png`.

## 라이브러리

- 정렬 라이브러리 없음. 드래그는 의존성 없이 Pointer Events로 구현했다(터치 포함 테스트 통과). 외부 CDN은 폰트(Google Fonts, SUIT jsDelivr, 네이버 마루부리)만 쓴다. 
- 테스트 전용: Playwright 1.58.2 (Apache-2.0). 프로젝트 의존성에는 추가하지 않았다.

## 한계 (완료라고 주장하지 않는 것)

- 서버 저장, 권한, 동시 편집, Next.js My rooms 통합은 없다. 저장은 이 브라우저의 localStorage뿐이다.
- 이미지는 여전히 data URL이다. 용량 초과 시 이제 분명하게 알려주지만, 이미지는 Download JSON으로만 보관된다. 실서비스에서는 업로드 스토리지 URL로 바꿔야 한다.
- 템플릿 쪽은 바꾸지 않았으므로 템플릿이 편집기로 보내는 메시지는 여전히 `'*'`이고 origin 확인도 없다. 편집기 쪽만 좁혔다.
- 글쓰기는 textarea + Markdown 삽입이다. 글쓰기 화면에서 굵게/기울임이 서식으로 보이지는 않는다(Tiptap은 다음 단계).
- 한글 IME는 CDP 조합 이벤트로 검증했다. 실제 macOS/Windows/iOS 한글 입력기로 하는 수동 확인은 하지 않았다.
- 터치 드래그는 Chromium 터치 에뮬레이션으로 검증했다. 실기기 iOS Safari 확인은 하지 않았다.
- QA 스크린샷은 headless에서 SUIT와 마루부리 대신 대체 폰트로 렌더링됐다(코드상 font-family는 지정되어 있고 테스트 5.2가 확인함).
- `heroId`는 v4처럼 첫 작품이다. 그래서 첫 작품을 바꾸면 큐레이션 기본 색도 바뀐다(의도된 v4 동작을 유지).
- 스크린 리더 실사용 점검(VoiceOver/NVDA)은 하지 않았다. aria 속성과 live region 안내만 넣었다.
