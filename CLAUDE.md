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
│   │   └── AuthGuard.ts         # JWT 기반 경량 인증 가드
│   └── utils/
│       └── StyleInjector.ts     # <style> 블록 → DOM <style> 태그 주입
├── dist/
│   └── vue-zero.js              # 빌드 결과물
├── build.js                     # esbuild 빌드 + ../template/app/assets/js/ 자동 복사
├── test/                        # E2E 스위트 (Playwright) — 아래 "테스트" 섹션 참고
├── scripts/                     # 릴리스 게이트: verify-static/verify-e2e/verify-published, changelog(릴리스 노트 추출)
├── CHANGELOG.md                 # 버전별 변경 (GitHub Release 본문의 원본)
├── .github/workflows/ci.yml       # main push/PR → E2E (publish 안 함, 게이트 환경을 태그 전에 미리 검증)
├── .github/workflows/publish.yml  # 태그 v* push → 검증 게이트 → npm publish → Release
├── package.json
└── README.md
```

## 개발 명령어

```bash
pnpm install     # 의존성 (pnpm 전용, npm install 금지)
pnpm dev         # 빌드 watch 모드 (파일 변경 시 자동 빌드 + template에 복사)
pnpm build       # 배포용 단일 파일 빌드
pnpm test        # 전체 E2E (Playwright, 앱 4개 병렬)
pnpm test:basic  # basic 앱만
```

빌드 시 `../template/app/assets/js/vue-zero.js`에 자동 복사됩니다.

## 테스트

라이브러리 자체 E2E 스위트가 `test/`에 있습니다 (Playwright + Chromium, 의존성 없는 Node 정적 서버. wrangler/template 불필요, Vue·vue-router도 devDependency로 로컬 서빙).

```
test/
├── server.mjs              # 정적 서버(SPA fallback) + 픽스처 API(/api/login, /api/token, /api/me, /api/slow, /api/status/:code). HEAD 는 405
├── jwt.mjs                 # 테스트용 HS256 JWT (서버·e2e 공유)
├── playwright.config.js    # 앱별 project + webServer (포트 4101~4104)
├── scripts/gen-stress.mjs  # stress 앱 컴포넌트 300개 생성 (생성물은 .gitignore)
├── apps/{basic,auth,custom-dirs,stress}/   # 각 앱의 index.html 은 window.__VZ_OPTIONS__ 를 createApp 옵션으로 쓴다
└── e2e/{basic,auth,custom-dirs,stress}/*.spec.js, e2e/helpers.js
```

- 기본은 `../dist/vue-zero.js`를 검증한다. 소스를 고쳤으면 먼저 `pnpm build`. 다른 파일을 검증하려면 `VUEZERO_DIST=<경로> pnpm test` (예: tarball에서 꺼낸 dist).
- 일부 앱만: `VZ_APPS=basic,auth pnpm exec playwright test -c test/playwright.config.js --project=basic --project=auth`.
- 알려진 라이브러리 버그를 재현만 해 두고 아직 고치지 않는 경우 `test.fixme(!process.env.VZ_RUN_FIXME, '사유')` 로 남기고 `VZ_RUN_FIXME=1` 로 실행해 재현한다. 현재 fixme 없음 (v1.3.1 에서 "빠른 연속 이동" 레이스 수정).
- 테스트 검증력 확인(변이): `VUEZERO_DIST` 에 과거 릴리스의 dist 를 넣어(`git show <커밋>:dist/vue-zero.js > /tmp/x.js`) 회귀 테스트가 실제로 실패하는지 본다. 예: v1.2.0 dist 는 지연 로딩/base64url 테스트가, v1.1.3 dist 는 isReady 회귀가 실패해야 한다.
- 앱별 옵션은 `useOptions(page, {...})`(addInitScript)로 주입하고, 토큰은 `seedStorage`로 주입한다. 네트워크 실패/지연은 `page.route` 와 `gate()`(수동 해제)로 만든다. 고정 sleep 금지 — 상태를 기다린다(`settle()`은 프레임만 흘려보낸다).
- 테스트 앱 코드도 vue-zero 규칙(Options API, scoped 금지, import 없음)을 따른다.

**규칙:** 버그 수정은 반드시 재현 테스트와 함께 넣는다 (테스트 이름/주석에 버전 표기). 라이브러리 동작을 바꾸는 변경은 `pnpm build && pnpm test` 통과 후에만 커밋한다.

**검증 방침:** 단발성 브라우저 확인은 ego-browser, 정기·반복 E2E 회귀 테스트는 Playwright(`test/`, `pnpm test`)를 사용합니다. 단발 확인에서 잡은 중요한 시나리오는 `test/e2e/`로 승격합니다. (`../template/tests/`는 데모 앱 자체의 테스트다.)

## 구현 규칙

- **빌드 결과물**: `dist/vue-zero.js` 단일 파일만. `.d.ts`, `.map` 등 생성 금지
- **에러 처리**: 브라우저 콘솔에 명확한 에러 메시지 출력
- **의존성 없음**: Vue 3 외 런타임 의존성 금지
- **주석 최소화**: 코드가 자명하면 주석 생략
- **CSP**: Blob URL + dynamic import 사용. `unsafe-eval` 의존 금지

## npm 배포

**1.3.1부터 적용** (1.3.1이 게이트를 통과하는 첫 릴리스). 게시는 CI 게이트(정적 검증 + E2E)를 통과한 태그 push로만 이루어집니다. **`v1.3.0` 태그는 만들지 않습니다**(1.3.0은 로컬 publish로 이미 게시됨, provenance 없음 — `CHANGELOG.md` 상단 참고).

1. `package.json` 버전을 올리고 `CHANGELOG.md`에 `## [X.Y.Z] - YYYY-MM-DD` 항목 추가 (GitHub Release 본문이 여기서 추출됨)
2. `pnpm run build` 후 `dist/vue-zero.js`까지 **커밋** (커밋/푸시를 배포보다 먼저)
3. `pnpm run release:check` — CI와 같은 `scripts/verify-static.mjs` + `scripts/verify-e2e.mjs`를 로컬에서 실행 (src·dist·메타 파일이 클린해야 통과, 이미 게시된 버전이면 실패)
4. `git push` 후 `git tag vX.Y.Z && git push origin vX.Y.Z`
5. CI(`.github/workflows/publish.yml`)가 verify-static ∥ verify-e2e → publish(`--provenance`) → post-publish 검증(레지스트리·tarball dist 동일) → GitHub Release 순으로 자동 진행. publish 잡은 재빌드 없이 커밋된 dist를 그대로 게시한다. 일부 잡만 실패하면 "Re-run failed jobs"로 재실행(전체 재실행은 이미 게시된 버전 검사로 실패)

**로컬 직접 `npm publish`는 CI 장애 시 핫픽스 경로로만** 사용합니다(`prepublishOnly`가 경고만 출력하고 막지는 않음). 이 경우 provenance가 없고 게이트를 건너뛰므로 사유를 `CHANGELOG.md`에 남깁니다.
