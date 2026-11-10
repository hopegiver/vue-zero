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
├── package.json
└── README.md
```

## 개발 명령어

```bash
npm run dev      # 빌드 watch 모드 (파일 변경 시 자동 빌드 + template에 복사)
npm run build    # 배포용 단일 파일 빌드
```

빌드 시 `../template/app/assets/js/vue-zero.js`에 자동 복사됩니다.
template에서 `wrangler dev`를 실행하면 즉시 반영됩니다.

## 테스트

라이브러리 테스트는 `../template/`에서 `wrangler dev`로 실행합니다.

```bash
# 터미널 1: 라이브러리 watch
cd package && npm run dev

# 터미널 2: 앱 서버
cd template && wrangler dev
```

http://localhost:8787 에서 확인합니다.

**검증 방침:** 단발성 브라우저 확인은 ego-browser, 정기·반복 E2E 회귀 테스트는 Playwright(`../template/tests/`, `npm test`)를 사용합니다.

## 구현 규칙

- **빌드 결과물**: `dist/vue-zero.js` 단일 파일만. `.d.ts`, `.map` 등 생성 금지
- **에러 처리**: 브라우저 콘솔에 명확한 에러 메시지 출력
- **의존성 없음**: Vue 3 외 런타임 의존성 금지
- **주석 최소화**: 코드가 자명하면 주석 생략
- **CSP**: Blob URL + dynamic import 사용. `unsafe-eval` 의존 금지

## npm 배포

**1.3.1부터 적용.** 게시는 CI 게이트(정적 검증 + E2E)를 통과한 태그 push로만 이루어집니다. **`v1.3.0` 태그는 만들지 않습니다**(1.3.0은 로컬 publish로 이미 게시됨, provenance 없음 — `CHANGELOG.md` 상단 참고).

1. `package.json` 버전을 올리고 `CHANGELOG.md`에 `## [X.Y.Z] - YYYY-MM-DD` 항목 추가 (GitHub Release 본문이 여기서 추출됨)
2. `pnpm run build` 후 `dist/vue-zero.js`까지 **커밋** (커밋/푸시를 배포보다 먼저)
3. `pnpm run release:check` — CI와 같은 `scripts/verify-static.mjs` + `scripts/verify-e2e.mjs`를 로컬에서 실행 (작업 트리가 클린해야 통과)
4. `git push` 후 `git tag vX.Y.Z && git push origin vX.Y.Z`
5. CI(`.github/workflows/publish.yml`)가 verify-static ∥ verify-e2e → publish(`--provenance`) → post-publish 검증(레지스트리·tarball dist 동일) → GitHub Release 순으로 자동 진행

**로컬 직접 `npm publish`는 CI 장애 시 핫픽스 경로로만** 사용합니다(`prepublishOnly`가 경고만 출력하고 막지는 않음). 이 경우 provenance가 없고 게이트를 건너뛰므로 사유를 `CHANGELOG.md`에 남깁니다.
