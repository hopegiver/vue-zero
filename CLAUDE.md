# vue-zero — 라이브러리 패키지

## 새 세션 부트스트랩
- **L0 (자동 주입):** `STATUS.md`(라이브 상태, 3,000바이트 이내 유지 — 검사 커맨드는 malgn-agent의 `project-standards` 스킬 §3이 정본) + 이 `CLAUDE.md`. 대부분 이것만으로 충분.
- **L1 (필요할 때만):** malgnai-hub `project_get_context` — L0로 충분하면 호출하지 않는다.
- **L2 (깊은 작업만):** `docs/README.md` 지도 → 필요한 문서만.

**STATUS.md 재작성은 다음 6가지 상황으로 제한한다** — 그 외 평범한 진행 중에는 건드리지 않는다:
①중요한 작업 완료 ②WBS 단계 변경 ③중요한 설계 결정 ④blocker 발생/해결 ⑤세션 종료 ⑥context compact 직전.
그 외에는 malgnai-hub `work_record`/`decision_record`/`issue_record`에만 기록하고 STATUS.md는 그대로 둔다.

**필수 규율:** 주요 결정/이슈/교훈은 malgnai-hub에 기록.

## 개요

vue-zero는 AI 개발을 위한 제로빌드 Vue 3 라우터 라이브러리입니다.
이 패키지는 `dist/vue-zero.js` 단일 파일을 빌드·배포하는 라이브러리 코드만 포함합니다.
앱 코드(pages, components, server 등)는 별도 리포(`../template/`)에서 관리합니다.

## 핵심 철학 (절대 원칙)

### 1. 제로빌드
- 앱 개발자는 빌드 스텝이 없다 — 브라우저에서 직접 실행
- `dist/vue-zero.js` 한 파일만 CDN으로 제공. `.d.ts` 등 부산물 없음

### 2. AI 친화
- Vue 3 Options API 표준 문법만 사용 — vue-zero 전용 문법/매크로/특수 기능 금지
- `<script setup>`, TypeScript, Composition API 지원 안 함
- 새 기능 추가 기준: "AI가 Vue 표준 지식만으로 이 기능을 쓸 수 있는가?" — NO면 추가하지 않음

## 프로젝트 구조

```
package/
├── src/
│   ├── vue-zero.ts              # 메인 진입점 — createApp() 단일 API
│   ├── core/
│   │   ├── SfcParser.ts         # .vue 파일 fetch → template/script/style 분리
│   │   ├── RouteScanner.ts      # pages/ 스캔 → 라우트 자동 등록
│   │   ├── ComponentLoader.ts   # components/ 스캔 → 전역 컴포넌트 자동 등록
│   │   ├── Inflight.ts          # 동시 로드 병합 + 힌트(quiet) 요청 실패 시 정규 경로 재시도
│   │   ├── Manifest.ts          # vz-manifest.json 로드(E_MANIFEST_FETCH 폴백) + Cache Storage 영속 캐시(옵트인)
│   │   ├── AuthGuard.ts         # JWT 기반 경량 인증 가드
│   │   └── Diagnostics.ts       # report() · VueZero.errors() 링 버퍼 · VzError (구조화 에러)
│   └── utils/
│       └── StyleInjector.ts     # <style> 블록 → DOM <style> 태그 주입
├── dist/
│   └── vue-zero.js              # 빌드 결과물
├── build.js                     # esbuild 빌드 + ../template/app/assets/js/ 자동 복사
├── bench/                       # 로딩 성능 벤치(vz·vz-manifest·vz-immutable·nuxt). 결과·한계는 bench/RESULTS.md, 예산 게이트는 `pnpm bench:budget`
├── docs/architecture/manifest-format.md  # vz-manifest.json 형식 v1 명세 (생성기 참조 구현은 ../template/bin/scan.js)
├── test/                        # E2E 스위트 (Playwright) — 아래 "테스트" 섹션 참고
├── scripts/                     # 릴리스 게이트: verify-static/verify-e2e/publish-gate(prepublishOnly), verify-published(publish 후 수동 확인), changelog(릴리스 노트 추출)
├── CHANGELOG.md                 # 버전별 변경 (GitHub Release 본문의 원본)
├── .github/workflows/ci.yml       # main push/PR → E2E (게이트 환경을 태그 전에 미리 검증)
├── .github/workflows/release.yml  # 태그 v* push(또는 수동 tag 입력) → verify-static ∥ verify-e2e → GitHub Release (npm publish 안 함)
├── package.json
└── README.md
```

## 개발 명령어

```bash
pnpm install     # 의존성 (pnpm 전용, npm install 금지)
pnpm dev         # 빌드 watch 모드 (파일 변경 시 자동 빌드 + template에 복사)
pnpm build       # 배포용 단일 파일 빌드
pnpm check       # (개발 중 기본) 필요 시 빌드 → E2E, 성공하면 1줄·실패하면 실패 지점만 출력 (토큰 절약). 이후 인자는 playwright 로: pnpm check -- -g "제목 일부"
pnpm test        # 전체 E2E 상세 출력 (list 리포터 — 성공해도 80여 줄, 실패 시 수천 줄)
pnpm test:basic  # basic 앱만
pnpm bench:budget  # 규모 M 결정적 지표(요청 수·바이트·웜 .vue·웨이브) 예산 게이트
```

빌드 시 `../template/app/assets/js/vue-zero.js`에 자동 복사됩니다.

## 테스트

라이브러리 자체 E2E 스위트가 `test/`에 있습니다 (Playwright + Chromium, 의존성 없는 Node 정적 서버. wrangler/template 불필요, Vue·vue-router도 devDependency로 로컬 서빙).

```
test/
├── server.mjs              # 정적 서버(SPA fallback) + 픽스처 API(/api/login, /api/token, /api/me, /api/slow, /api/status/:code). HEAD 는 405
├── jwt.mjs                 # 테스트용 HS256 JWT (서버·e2e 공유)
├── playwright.config.js    # 앱별 project + webServer (포트 4101~4105)
├── scripts/gen-stress.mjs  # stress 앱 컴포넌트 300개 생성 (생성물은 .gitignore)
├── scripts/gen-manifest.mjs # vz-manifest.json 형식 v1 테스트 전용 생성기 (참조 구현은 template/bin/scan.js). 명세: docs/architecture/manifest-format.md
├── fixtures/manifest-golden/ # 골든 픽스처(app/ + expected/). template/tests/fixtures/manifest-golden 과 바이트 동일해야 한다
├── apps/{basic,auth,custom-dirs,stress,manifest-app}/   # 각 앱의 index.html 은 window.__VZ_OPTIONS__ 를 createApp 옵션으로 쓴다. manifest-app 의 vz-manifest.json/pages.json/components.json 은 webServer 가 서버 시작 전에 gen-manifest.mjs 로 만든다(.gitignore)
└── e2e/{basic,auth,custom-dirs,stress,manifest-app}/*.spec.js, e2e/manifest/golden.spec.js(브라우저 없는 Node 테스트, project `manifest`), e2e/helpers.js (basic 의 boot-requests.spec.js 는 404/error 지연 확인과 부팅 요청 목록)
```

- **AI/개발 중에는 `pnpm check` 를 쓴다.** 성공 1줄, 실패는 `파일:줄 + 오류 요약(기대/실제 diff 포함)`만 나온다(전체는 `test/.results/last.json`). 직접 실행은 `node scripts/check.mjs`(pnpm 12 는 `-s` 옵션 없음). 같은 실패를 `pnpm test`(list)로 보면 수천 줄·70KB 이므로 상세가 꼭 필요할 때만 쓴다.
- **Stop 훅 자동 검증** (`.claude/settings.json` → `scripts/hook-check.mjs`): 세션이 끝나기 전에 src/test/scripts 가 마지막 통과 이후 바뀌었을 때만 `check` 를 1회 실행한다. 통과하면 출력 0, 실패하면 요약을 피드백으로 돌려 수정을 이어가게 한다. 바뀐 게 없으면 즉시 종료(0.1초). 끄기: `VZ_NO_HOOK=1`. 환경 문제(브라우저 없음 등)는 작업을 막지 않는다.
- 기본은 `../dist/vue-zero.js`를 검증한다. 소스를 고쳤으면 먼저 `pnpm build`. 다른 파일을 검증하려면 `VUEZERO_DIST=<경로> pnpm test` (예: tarball에서 꺼낸 dist).
- 일부 앱만: `VZ_APPS=basic,auth pnpm exec playwright test -c test/playwright.config.js --project=basic --project=auth`.
- 알려진 라이브러리 버그를 재현만 해 두고 아직 고치지 않는 경우 `test.fixme(!process.env.VZ_RUN_FIXME, '사유')` 로 남기고 `VZ_RUN_FIXME=1` 로 실행해 재현한다. 현재 fixme 없음 (v1.3.1 에서 "빠른 연속 이동" 레이스 수정).
- 테스트 검증력 확인(변이): `VUEZERO_DIST` 에 과거 릴리스의 dist 를 넣어(`git show <커밋>:dist/vue-zero.js > /tmp/x.js`) 회귀 테스트가 실제로 실패하는지 본다. 예: v1.2.0 dist 는 지연 로딩/base64url 테스트가, v1.1.3 dist 는 isReady 회귀가 실패해야 한다.
- 앱별 옵션은 `useOptions(page, {...})`(addInitScript)로 주입하고, 토큰은 `seedStorage`로 주입한다. 네트워크 실패/지연은 `page.route` 와 `gate()`(수동 해제)로 만든다. 고정 sleep 금지 — 상태를 기다린다(`settle()`은 프레임만 흘려보낸다).
- 영속 캐시(Cache Storage)는 dev 호스트(127.0.0.1)에서 꺼지므로 `manifest-app` 의 캐시 테스트는 `serveAsProd(context, baseURL)`(helpers.js)로 가짜 https 출처 `PROD` 를 로컬 서버로 중계해 prod 호스트를 흉내 낸다. 동시 요청 증명은 `barrier()`(N건이 모두 도착해야 응답을 푼다)로, 인증 순서는 SFC 응답을 붙잡은 채 요청 목록으로 단언한다. 스펙: `manifest-boot`(옵트인·폴백·deps), `manifest-cache`(적중/미적중/해시 변경/정리/폴백), `manifest-auth`(미인증에게 deps 선행 금지).
- 진단 테스트: `e2e/basic/diagnostics.spec.js`(코드·버퍼·sourceURL 줄 정렬·dev 경고), `e2e/basic/loading.spec.js`(in-flight 병합·레이아웃 캐시), `e2e/auth/login-guard.spec.js`(loginPage 루프·인증 순서). 앱 안의 오류 재현 픽스처는 `test/apps/basic/pages/err-*.vue`, `layouts/boom.vue`, `components/Boom.vue`. 앱에 쌓인 보고는 `helpers.js`의 `vzErrors(page)`(=`VueZero.errors()`)로 읽고, 콘솔 메시지의 Error 인자 스택은 `collectMessages(page)`로 본다. 게이트로 붙잡힌 이동은 `spaStart`(완료를 기다리지 않음)로 시작한다.
- `pnpm build` 는 `../template/app/assets/js/` 로 dist 를 복사한다. 다른 저장소를 건드리지 않으려면 `VZ_NO_TEMPLATE_COPY=1 pnpm build`(check 도 동일).
- 테스트 앱 코드도 vue-zero 규칙(Options API, scoped 금지, import 없음)을 따른다.

**규칙:** 버그 수정은 반드시 재현 테스트와 함께 넣는다 (테스트 이름/주석에 버전 표기). 라이브러리 동작을 바꾸는 변경은 `pnpm build && pnpm test` 통과 후에만 커밋한다.

**검증 방침:** 단발성 브라우저 확인은 ego-browser, 정기·반복 E2E 회귀 테스트는 Playwright(`test/`, `pnpm test`)를 사용합니다. 단발 확인에서 잡은 중요한 시나리오는 `test/e2e/`로 승격합니다. (`../template/tests/`는 데모 앱 자체의 테스트다.)

## 구현 규칙

- **빌드 결과물**: `dist/vue-zero.js` 단일 파일만. `.d.ts`, `.map` 등 생성 금지
- **에러 처리**: 모든 오류·경고는 `console.*` 직접 호출이 아니라 `report({code, stage, file, line?, message, hint})`(`core/Diagnostics.ts`)로 낸다. 안정 코드(`E_…`) + 파일 경로 + 해결 hint 필수, 콘솔 형식 `[vue-zero] CODE file:line — message` + 다음 줄 `hint: …`. 로드/파싱 단계 오류는 `VzError`를 throw 하고 잡는 쪽에서 `reportCaught` 한 번만 보고한다(중복 보고 금지). load/parse/manifest/auth 단계는 경로·HTTP 상태만 담는다. runtime/render/route/Vue 경고는 메시지를 남기되 `report()`가 JWT·Bearer·이메일·숫자와 영문이 섞인 32자 이상 토큰을 마스킹하고 300자로 자른다(콘솔의 원본 Error 인자는 유지). 새 코드는 README 의 "Errors and Diagnostics" 표에 추가한다
- **스크립트 평가**: `.vue` 의 `<script>` 는 trim 하지 않고 앞쪽 줄 수만큼 `\n` 을 채운 뒤 `//# sourceURL=<.vue 경로>` 를 붙여 실행한다(스택이 실제 .vue 줄을 가리키게). `<script>` 파싱을 건드릴 때 이 줄 정렬이 깨지지 않게 한다
- **인증 가드 순서**: 인증 검사는 SFC 파싱 직후, 컴포넌트 preload/레이아웃 로드 **앞**이다. loginPage 가 보호 상태면 `E_LOGIN_PAGE_PROTECTED`로 보고하고 그 loginPage 경로로의 이동만 통과시켜(같은 라우트의 다른 경로는 계속 리다이렉트) 루프를 끊는다
- **404/error 지연 로드**: `404.vue`/`error.vue` 존재를 부팅 때 fetch 하지 않는다. catch-all 라우트는 항상 등록하고 처음 필요할 때 로드하며, 없으면(404) 그 사실만 캐시한다(404.vue 없음: 빈 본문 + `E_NOT_FOUND_PAGE` 1회, error.vue 없음: 조용히 생략)
- **매니페스트(옵트인 `manifest`)**: 매니페스트의 `has404`/`hasError`/`build` 는 라이브러리가 읽지 않는다. `deps` 는 힌트라 틀려도 동작이 같아야 하며, 인증이 켜진 미인증 상태에서는 SFC 의 auth 판단 뒤에만 `deps` 를 시작한다. 영속 캐시는 같은 출처의 정적 `.vue` 소스만, **본문 해시가 매니페스트 값과 일치하고 OK·비리다이렉트인 응답만** 저장한다(토큰·사용자 데이터 금지, 해시 정규화는 명세와 동일), dev 호스트에서는 끈다. 힌트(`deps`)가 시작한 선행 요청의 실패는 보고·캐시하지 않고 정규 경로가 필요할 때 다시 받아 보고한다(`core/Inflight.ts`). 형식을 바꾸면 `v` 를 올리고 template 생성기·골든 사본을 함께 갱신한다
- **로더 캐시**: 같은 파일의 동시 로드는 in-flight Promise 로 병합하고(실패 시 맵에서 삭제), 레이아웃은 404 일 때만 null 캐시한다
- **의존성 없음**: Vue 3 외 런타임 의존성 금지
- **주석 최소화**: 코드가 자명하면 주석 생략
- **CSP**: Blob URL + dynamic import 사용. `unsafe-eval` 의존 금지

## 릴리스 (GitHub Release)와 npm 게시

**태그/Release와 npm 게시는 분리됩니다.** 태그 push → CI 게이트 → GitHub Release는 파이프라인이 자동으로 하고, npm publish는 소유자가 가끔 최종 버전만 로컬에서 직접 합니다. npm에 게시하지 않은 버전도 태그·Release가 존재할 수 있습니다(`v1.3.1`: npm 미게시 태그, 삭제하지 않음). 게이트는 1.4.0부터 적용되며 `v1.3.0` 태그는 만들지 않습니다.

1. `package.json` 버전을 올리고 `CHANGELOG.md`에 `## [X.Y.Z] - YYYY-MM-DD` 항목 추가 (Release 본문이 여기서 추출됨. npm에 게시하지 않을 버전은 제목 끝에 ` (GitHub 릴리스만, npm 미게시)`). `pnpm run build` 후 `dist/vue-zero.js`까지 **커밋**
2. `pnpm run release:check` — CI와 같은 `scripts/verify-static.mjs` + `scripts/verify-e2e.mjs`를 로컬에서 실행 (src·dist·메타 파일이 클린해야 통과, 로컬에서는 push 여부를 경고만 함)
3. `git push origin main` (CI `ci.yml` E2E 확인) → `git tag vX.Y.Z` → `git push origin vX.Y.Z`
4. `.github/workflows/release.yml`이 verify-static(`--allow-published`) ∥ verify-e2e → GitHub Release 생성(제목 `vX.Y.Z`, 본문은 기본 브랜치 `CHANGELOG.md`의 해당 항목 + 마지막 줄에 npm 게시 여부). 이미 Release가 있으면 노트만 갱신(멱등)이라 "Re-run all jobs"도 안전. 기존 태그 재실행/소급 릴리스는 Actions → Release → Run workflow에 `tag` 입력(워크플로 파일은 main 것이 쓰이고, 체크아웃은 그 태그)
5. **npm 게시(소유자, 로컬, 가끔 최종 버전만):** `npm publish` 시 `prepublishOnly`(`scripts/publish-gate.mjs`)가 `verify-static --require-pushed`(`git fetch --tags` 후 HEAD가 `origin/main`에 없으면 FAIL, `v<package.json 버전>` 태그가 없거나 태그 커밋 != HEAD이면 FAIL, 이미 npm에 게시된 버전이면 FAIL) + `verify-e2e`를 실행하고 실패하면 publish를 막는다. 긴급 시에만 `VZ_SKIP_GATE=1`(큰 경고 후 통과, 사유를 CHANGELOG에 남김). 게이트는 실수 방지용이라 `npm publish --ignore-scripts`·tarball 직접 게시는 우회되므로 **하지 말 것**. 통과 후 `pnpm verify:published` — 레지스트리 노출과 게시된 tarball의 dist == 커밋된 dist(바이트 동일)를 1줄로 확인(태그 없는 과거 버전은 `--ref <커밋>`)
   게시 후 Actions → Release → Run workflow(`tag=vX.Y.Z`)로 Release 노트의 npm 줄을 갱신한다(태그 시점엔 미게시로 적혀 있다).

Trusted Publisher/CI npm 게시: 현재 미사용.
