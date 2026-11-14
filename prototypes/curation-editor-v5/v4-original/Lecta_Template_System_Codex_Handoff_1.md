# Lecta 큐레이션 템플릿 v4, Codex 핸드오프

작성일 2026-11-14. 브랜치 `feat/curation-templates-v4`, 경로 `prototypes/curation-templates/`.
Next.js 앱에는 아직 연결하지 않은 단독 HTML 프로토타입 3종, 공용 엔진, My rooms 안에서 쓰는 큐레이션 에디터다.

## 0. 파일

| 파일 | 역할 |
|---|---|
| `the-spread.html` | 잡지 내지형 템플릿 (THE SPREAD). v3의 Cabinet을 대신한다 |
| `the-edit.html` | 큰 활자 에세이형 템플릿 (THE EDIT) |
| `afterimage.html` | 다크 템플릿 (AFTERIMAGE) |
| `curation-editor.html` | My rooms 의 큐레이션 편집 화면 |
| `src/shared/palette.js` | 색 추출 엔진. 서버 저장 시점 추출에 그대로 옮겨 쓴다 |
| `src/shared/core.js` | 데이터 정규화, 노트 파서, 플래너, 리빌, 에디터 연동 채널 |
| `src/shared/art-samples.js` | 데모용 절차적 SVG 표지와 샘플 세트. 실서비스에서는 필요 없다 |
| `src/*.src.html`, `build.mjs` | 원본과 빌드. `node build.mjs [접두어]` 로 공용 JS를 인라인해 단독 파일을 만든다 |
| `v3/` | 은퇴한 Cabinet 보관본. 갱신하지 않았다 |
| `v2/` | 이전 라운드 보관본 |

모든 HTML은 외부 의존 없이 열린다. 폰트만 CDN에서 불러온다. 에디터는 같은 폴더의 템플릿 파일을 iframe 으로 불러오므로 로컬에서는 `python3 -m http.server` 같은 정적 서버로 연다.

## 1. 이번 라운드 요구

1. 잡지 내지처럼 편집한다. 모든 작품이 "표지 아래 글" 구조가 되지 않게, 큰 제목, 여러 단의 작은 본문, 장면 사진, 인용문, 세로 러닝 타이틀, 쪽 번호, 하단 워드마크를 쓴다.
2. 사용자가 작품의 장면(스틸, 직접 찍은 사진)을 넣을 수 있다. 넣지 않으면 그 자리에 표지가 놓인다.
3. 편집 화면은 My rooms 안에 있다. 기존 Curate 화면 모양을 따르지 않고 새로 설계했다.
4. 화면에 보이는 단어 "exhibition"을 모두 "Curation"으로 바꿨다. 코드 식별자도 `buildCurationTheme` 등으로 바꿨다.
5. Cabinet 콘셉트는 뺐다.
6. 미니멀하게. 색 그라데이션, 번짐, 글로우, 그레인을 템플릿 UI에서 모두 뺐다. 색은 평평한 면으로만 쓴다.
7. 색인 목록 글꼴을 다듬었다. 번호는 tabular numerals, 제목은 Instrument Serif(한글은 마루부리 Light), 번호와 제목을 그리드로 정렬했다.

유지되는 규칙: 누리끼리한 종이색 배경 금지, 항목마다 두르는 테두리 금지, 숫자나 글자 옆 색 막대 금지, 가운뎃점과 불릿 금지(쉼표, 슬래시, 줄바꿈으로 구분), 색은 작품에서 뽑는다, 블로그처럼 쓴 입력이 들어와도 일정한 품질.

## 2. 데이터 모델

세 템플릿이 같은 입력을 받고 렌더러만 다르다. 템플릿을 바꿔도 작품, 글, 장면, 순서는 그대로다.

```
Curation {
  title, subtitle?, curator?, intro?,
  accentIndex?: number          // 벽 색 칩 선택. 없으면 자동
  template?: 'the-spread' | 'the-edit' | 'afterimage'
  items: Work[]
}
Work {
  id, title, creator, year,
  medium: 'film' | 'book' | 'album' | 'series' | ...
  reason?: string               // 왜 이 작품인가, 한 줄
  note?: string                 // 본문. 블로그 입력 그대로
  cover?: { src }               // 없으면 작품 색의 타이포 표지
  scenes?: [{ src, caption? }]  // 장면. 없으면 표지가 대신한다
  layout?: '' | 'page' | 'inset' | 'full' | 'plate' | 'quote'   // '' 는 자동
  featured?: boolean
  palette?: [{ hex, weight }]   // 저장된 팔레트. 있으면 이미지 없이 같은 색
}
```

- `normalizeItem` 이 `reason` 과 `note` 를 합쳐 하나의 글로 만든다(reason 이 첫 문단).
- 예전 `photo` 필드는 첫 장면으로 바뀐다.
- `L.visual(it)` 은 첫 장면, 없으면 표지. `L.media(it)` 는 장면 목록, 없으면 `[표지(isCover)]`.
- 팔레트는 표지에서, 표지가 없으면 첫 장면에서 뽑는다.
- 노트 규칙(`L.parseNote`): 빈 줄로 문단, `> ` 로 시작하는 줄은 인용문, `**굵게**`, `*기울임*` 만 지원. 모든 텍스트는 HTML 이스케이프.

## 3. 구성(kind) 어휘와 플래너

에디터에서 고르는 구성은 템플릿과 무관한 공용 어휘다. 각 템플릿은 자기 구성 타입에 `kind` 를 붙여 이 어휘에 연결한다.

| kind | THE SPREAD | THE EDIT | AFTERIMAGE |
|---|---|---|---|
| page | page: 왼쪽 리드, 오른쪽 단 나눈 본문, 장면 | split, column | 없음(Auto) |
| inset | inset: 두 쪽 펼침. 제목, 본문 단, 넓은 장면, 굵은 인용, 둘째 장면 | 없음(Auto) | side |
| full | full: 장면이 지면 전체, 제목이 아래 기준선 | bleed | immerse |
| plate | plate: 장면을 한쪽으로 비켜 놓고 옆에 글 | float | portal |
| quote | quote: 작품 색 면에 큰 인용문 | quote | type |

`L.plan` 규칙: 같은 타입 연속 금지, dense 연속 금지, sparse 세 번 연속 금지, `spaced`, `prefer`, `needs`, `fits`(글 길이 구간 none, line, short, medium, long). 작품의 `layout` 이 지정되어 있고 해당 템플릿에 그 kind 가 있으면 규칙보다 우선한다. 없으면 자동으로 놓는다. 결과는 `L.planned = [{id, type, kind, chosen}]`, 템플릿이 가진 kind 목록은 `L.kinds`.

## 4. THE SPREAD

- 흰 지면. 섹션마다 세로 러닝 타이틀(큐레이션 제목, 작품과 만든 사람), 쪽 번호, 하단 워드마크(매체 이름, DM Serif Display), 타원 윤곽의 매체와 연도 태그.
- 본문은 CSS columns 와 단 사이 세로선. 이 두 가지(타원 태그, 단 구분선)는 잡지 문법으로 의도한 선이다.
- 장면 클릭 시 라이트박스. 목차는 호버 시 표지 미리보기. 스크롤 리빌.
- 제목은 Instrument Serif, 한글은 마루부리, UI는 SUIT.

THE EDIT 와 AFTERIMAGE 는 그라데이션, 워시, 그레인, 글로우, 고스트 이미지를 모두 걷어내고 평평한 배경으로 정리했다. AFTERIMAGE 의 긴 글 첫 문단은 7줄에서 잘리고 Reader 로 전문을 연다.

## 5. 큐레이션 에디터 (`curation-editor.html`)

세 칸 구조.

| 영역 | 내용 |
|---|---|
| 상단 바 | Lecta, `My rooms / 제목`, 저장 상태, Open full preview, Download JSON, Save |
| 왼쪽 Pages | 00 Cover 와 작품 목록. 썸네일, 번호, 지금 구성(Auto 일 때 플래너가 고른 kind, 고정이면 `fixed`), 장면 수. 위아래 이동, Add a work |
| 가운데 Stage | 실제 템플릿을 iframe 으로 띄운 라이브 미리보기. 데스크톱 1280x800, 모바일 390x844 를 화면에 맞춰 축소. 이전, 다음 쪽 |
| 오른쪽 Inspector | Cover: 제목, 부제, 소개, 템플릿 카드 3종, 벽 색 칩(표지에서 뽑은 색). Work: 구성 6종(템플릿에 없는 kind 는 흐리게), 한 줄 이유, 본문(B, I, Pull quote 버튼, 글자 수, 길이 구간 안내), 장면(업로드, 드래그 앤 드롭, 캡션, 순서, 삭제, 비어 있으면 표지가 들어간다는 표시), 크게 보여주기, 제목과 만든 사람과 연도, 삭제(Undo 토스트) |

- 왼쪽에서 쪽을 고르면 미리보기가 그 쪽으로 이동하고, 미리보기를 스크롤하면 왼쪽과 오른쪽 선택이 따라온다(입력 중에는 따라오지 않는다).
- 자동 저장: localStorage `lecta.curation.draft.v2`. 용량을 넘으면 이미지를 빼고 글만 저장한다. `?fresh=1` 로 샘플에서 시작.
- 장면 이미지는 브라우저에서 긴 변 1800px JPEG data URL 로 줄인다. 실서비스에서는 업로드 스토리지 URL 로 바꿔야 한다.
- 작품 추가 대화상자는 지금 샘플 카탈로그를 검색한다. Lecta 작품 검색 API 로 바꾼다. 직접 추가(제목, 만든 사람, 연도, 매체, 표지 업로드)도 있다.
- 외부 연동 훅: `window.LectaEditor = { getData(), setData(curation), onSave(curation) }`.

### 에디터와 템플릿 사이 메시지

템플릿을 `?embed=1`(iframe, 상단 바 숨김) 또는 `?feed=1`(새 창)로 열면 외부 데이터 모드가 된다. 이 모드에서는 Preview 패널이 나오지 않는다.

| 방향 | type | 내용 |
|---|---|---|
| 템플릿 → 에디터 | `lecta:ready` | 데이터를 받을 준비가 됨 |
| 에디터 → 템플릿 | `lecta:curation` | `{ data: Curation, focus?: index }`. 다시 렌더링하되 스크롤 위치를 유지한다. `focus` 가 있으면 그 작품으로, `-1` 이면 맨 위로 |
| 에디터 → 템플릿 | `lecta:goto` | `{ index }`. 다시 렌더링 없이 이동. `-1` 은 커버 |
| 템플릿 → 에디터 | `lecta:state` | `{ chips, accentIndex, plan, kinds, palettes:[{id, palette, ar}] }` 렌더링마다 |
| 템플릿 → 에디터 | `lecta:view` | `{ index }` 화면 가운데 있는 작품. 커버는 `-1` |

## 6. 컬러 엔진 (`LectaPalette`)

표지 → 72px 캔버스 샘플링 → median cut → ΔE 14 미만 병합 → `[{hex, weight}]` → 작품 테마와 큐레이션 테마(`buildCurationTheme`). 섹션마다 `--field --tint --paper --ink --deep --soft --glow --on-field` 변수.

가드레일: 노랑, 올리브(hue 28~88)의 field 는 명도 0.16~0.25, 채도 0.34 이하. 밝은 면이 따뜻한 연한 색이면 차가운 중성(hue 216)으로 돌린다. 무채색 표지는 그래파이트. 표지가 없으면 id 와 제목 시드로 항상 같은 색. hue 전수 검사 1,920 조합에서 위반 0건.

서버 연동 권장: 저장 시점에 서버에서 `extract` 를 돌려 `palette` 를 저장하고, 렌더링은 `hydrate` 만 쓴다. CORS 와 이미지 로딩이 필요 없어진다.

## 7. 폰트

| 용도 | 폰트 |
|---|---|
| 브랜드, 워드마크 | DM Serif Display |
| UI, 캡션 | SUIT |
| 한글 본문, 한글 제목 | 마루부리, 보조 Noto Serif KR |
| SPREAD, EDIT, 에디터 영문 제목 | Instrument Serif |
| AFTERIMAGE 영문 제목 | Cormorant Garamond |

한글 제목은 합성 이탤릭을 쓰지 않는다(`hk`).

## 8. 병합 시 할 일

1. My rooms 의 큐레이션 편집 경로에 에디터를 옮긴다. React 로 옮길 때도 2절 모델과 5절 메시지 규약을 유지하면 템플릿을 그대로 iframe 미리보기로 쓸 수 있다.
2. 작품 검색, 표지와 장면 업로드를 실제 API 와 스토리지로 바꾼다.
3. 저장 시점에 서버에서 `LectaPalette.extract` 실행, `palette` 저장.
4. 색 이름 표(`nameOf`, 38개 임시)를 Lecta 것으로 바꾼다.
5. 프로토타입 도구(Preview 패널, 샘플 세트 A~D, `art-samples.js`)를 제거한다.
6. 폰트 로딩을 실제 방식으로 바꾸고 줄 높이를 눈으로 확인한다.

## 9. 검수

Playwright(Chrome) 1440x900 과 390px 모바일로 세 템플릿을 샘플 세트 A~D 에서 렌더링: 콘솔 오류 0, 가로 넘침 0. 세트 D 는 아주 긴 제목, 표지 없음, 가로와 세로 표지, 노란 표지, `<script>` 와 `<img onerror>` 입력, 이모지를 포함한다.

에디터: 쪽 선택과 미리보기 이동, 구성 변경, 장면 업로드, 긴 글 입력과 길이 구간 안내, 미리보기 스크롤에 따른 선택 이동, 템플릿 전환 3종, 모바일 전환, 작품 추가, 삭제와 Undo, 저장. 콘솔 오류 0.

출력물에서 "exhibition" 0건, 가운뎃점과 불릿 문자 0건, 템플릿 UI 의 그라데이션 0건.

한계:
- 샘플 표지와 장면은 절차적 SVG 라서 실제 사진의 색 추출과 차이가 있다. 샘플 그림 안에는 그라데이션이 있다(UI 가 아니라 데모 그림).
- QA 는 SUIT 대신 대체 폰트로 렌더링했다.
- 에디터는 프로토타입이다. 권한, 동시 편집, 서버 저장은 없다.
