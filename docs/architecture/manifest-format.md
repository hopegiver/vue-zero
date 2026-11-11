# vz-manifest.json 형식 v1

앱의 `app/vz-manifest.json`(웹 루트 `/vz-manifest.json`)은 scan 이 만드는 **힌트 파일**이다. 라이브러리가 소비하는 방식(옵트인 `manifest` 옵션)은 이 문서의 범위가 아니다. 형식을 바꾸면 `v` 를 올린다.

- **참조 생성기**: vue-zero-template `bin/scan.js` (`npm run scan`). 패키지 저장소는 생성기를 배포하지 않는다(npm tarball = dist 1파일).
- **테스트 전용 생성기**: `test/scripts/gen-manifest.mjs` (같은 명세의 독립 구현).
- **골든 테스트**: 같은 픽스처 앱 `test/fixtures/manifest-golden/app` ≡ 템플릿 `tests/fixtures/manifest-golden/app` 과 기대 파일 `expected/{vz-manifest,pages,components}.json` 이 두 저장소에 **바이트 동일**하게 있고, 각 저장소 테스트가 자기 생성기 출력 == 기대 파일을 검증한다(`test/e2e/manifest/golden.spec.js`, 템플릿 `bin/scan.test.js`). 형식·알고리즘을 바꾸면 양쪽 생성기와 두 사본의 기대 파일을 함께 갱신한다.
- `pages/pages.json`, `components/components.json` 은 지금처럼 계속 생성된다(사람이 읽는 형식, 기존 앱 호환). 매니페스트는 추가 산출물이다.

## 필드

```json
{"v":1,"build":"<64자 hex>","pages":["about","index"],"components":["AppButton"],"has404":true,"hasError":false,
 "files":{"components/AppButton.vue":"86fe3c247d","layouts/default.vue":"6d6cfd12ae","pages/about.vue":"bea73300b6"},
 "deps":{"pages/about.vue":{"layout":"default","components":["AppButton"]}}}
```

| 필드 | 타입 | 의미 |
|---|---|---|
| `v` | number | 형식 버전. 현재 `1` |
| `build` | string | `files` 객체를 `JSON.stringify`(키 정렬 상태) 한 문자열의 sha256 전체(64자 hex). 앱 전체 변경 감지용 |
| `pages` | string[] | `pages.json` 과 같은 내용(`pages/` 아래 `.vue` 의 확장자 뺀 상대 경로, `404`·`error` 제외, `.sort()`) |
| `components` | string[] | `components.json` 과 같은 내용(`components/` 아래 `.vue` 의 파일명(확장자 제외), `.sort()`) |
| `has404`, `hasError` | boolean | `pages/404.vue`, `pages/error.vue` 존재 여부 |
| `files` | { 경로: 해시 } | `pages/`·`components/`·`layouts/` 아래 모든 `.vue`. 키는 `app/` 기준 POSIX 상대 경로, 키 정렬. 값은 해시 10자 |
| `deps` | { 페이지 파일: 의존 } | 페이지 `.vue` 별 선행 로드 힌트(아래). `pages/error.vue` 는 없음. 판정 불가한 페이지는 항목 자체를 생략 |

직렬화: `JSON.stringify(manifest)`(공백 없음) + 끝 개행 1개. 필드 순서는 위 표 순서, `files`·`deps` 키는 정렬. 내용이 같으면 파일을 다시 쓰지 않는다.

## 해시

`sha256( 파일 내용을 UTF-8 문자열로 읽고 CRLF(`\r\n`)를 LF(`\n`)로 바꾼 것 )` 의 앞 10자(소문자 hex).
- **CRLF 정규화 이유**: Windows 체크아웃(autocrlf)과 서버에 올라가는 파일의 개행이 달라도 같은 해시가 나와야 `E_MANIFEST_STALE` 오탐과 캐시 낭비가 없다. 단독 `\r` 은 바꾸지 않는다.
- **BOM**: 선행 UTF-8 BOM(U+FEFF)은 **제거하지 않고 유지**한 채 해시한다. 생성기는 `readFileSync(.., 'utf8')`(BOM 유지), 라이브러리는 `TextDecoder('utf-8', { ignoreBOM: true })`(BOM 유지)로 읽으므로 두 쪽 해시가 같다. BOM 을 벗기는 디코더로 구현하면 BOM 파일의 해시가 어긋난다.
- **용도**: 해시는 영속 캐시 키(`?v=<해시>`)이면서 **저장 전 본문 검증값**이다. 라이브러리는 받은 본문(CRLF→LF 정규화, BOM 유지)의 sha256 앞 10자가 매니페스트 값과 같을 때만 Cache Storage 에 저장한다(다르면 저장하지 않고 그 응답만 쓴다). `crypto.subtle` 이 없으면 저장하지 않는다.
- 두 저장소 테스트가 "모든 .vue 를 CRLF 로 바꿔도 출력이 같다"를 검증한다.

## deps

각 페이지 `pages/x.vue` 에 대해 `{ "layout": <이름|false>, "components": [<이름>…] }`.

- **layout**: 페이지 `<script>` 에서 판정한다. 주석(`/* */`, `// …`)을 제거하고 `export default {` 객체의 **최상위 옵션 키만** 본다(괄호 `{}[]()` 깊이 1, 문자열 리터럴 안은 건너뜀). `data()`·`props`·중첩 객체 안의 `layout:` 키는 페이지 레이아웃이 아니므로 무시한다. 최상위에 `layout :` 키가 없으면 `"default"`, 정확히 한 번 `layout: 'a'` / `"a"` / `false` 리터럴이면 그 값, 그 밖(최상위 키 2회 이상, 변수·삼항 등 비리터럴, `export default {` 형태가 아니거나 괄호가 맞지 않는 스크립트에서 `layout :` 이 보이는 경우)은 **판정 불가 → 그 페이지의 deps 항목 생략**. 정규식 리터럴 안의 따옴표·괄호는 처리하지 않는다(드문 경우 판정이 틀릴 수 있고, deps 는 힌트라 동작은 같다).
- **components**: 페이지 템플릿(+ `layout` 이 `false` 가 아니고 `layouts/<layout>.vue` 가 있으면 레이아웃 템플릿)에서 정적으로 찾은 태그를 `components` 목록 이름으로 매핑하고, 그 컴포넌트들의 **템플릿 하위 컴포넌트까지 전이 폐포**로 모은 이름의 정렬 목록. 순환 참조는 한 번만 센다.
- 태그 매핑은 라이브러리 `ComponentLoader.findUsed` 와 같다: 템플릿 문자열에서 `<([A-Za-z][\w-]*)` 를 찾고 소문자·하이픈 제거로 정규화해 컴포넌트 이름과 비교(`<user-card>` == `UserCard`). 동적 `<component :is>` 나 JS 로 만든 이름은 못 잡는다.
- **deps 는 힌트일 뿐이다.** 틀리거나 없어도 앱은 매니페스트가 없을 때와 똑같이 동작해야 한다(느릴 뿐).

## 알려진 한계

- `components/` 하위 폴더의 컴포넌트는 `components.json`(파일명 기준)과 같이 이름만 올라가고, 라이브러리는 `components/<이름>.vue` 로 요청한다. `files` 에는 실제 경로가 들어간다.
- 템플릿 블록 추출은 `SfcParser` 와 같은 중첩 `<template>` 깊이 계산이다. `<script>` 는 첫 블록만 본다.
