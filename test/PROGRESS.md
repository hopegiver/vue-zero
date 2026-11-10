# 테스트 스위트 진행 요약

## 단계 1 (basic 앱 + 하네스)
- 만든 것: `test/server.mjs`(정적 서버+SPA fallback+픽스처 API, HEAD 는 405), `test/jwt.mjs`, `test/playwright.config.js`(앱별 project/포트 4101~4104, 앱별 webServer), `apps/basic`(페이지 27 / 컴포넌트 11 / 레이아웃 2), `e2e/basic/{components,sfc,routing,layouts,options,regressions}.spec.js`, `e2e/helpers.js`.
- 실행: `pnpm test` (전체) / `pnpm test:basic` (basic 만). `VUEZERO_DIST=<경로>` 로 라이브러리 교체, `VZ_RUN_FIXME=1` 로 알려진 버그 재현 테스트 실행.
- 테스트 수(basic): 47 = 46 pass + 1 fixme(skip). 실측 `pnpm test:basic` 약 3초(wall, 워커 4).
- 발견 버그(라이브러리, src 미수정): 아래 "발견 버그" 참조.

## 발견 버그
1. 취소된 느린 이동의 guard 부수효과가 최신 이동을 덮어씀 (v1.3.0 확인).
   `router.beforeEach` 가 await(SFC/레이아웃 로드) 이후 `currentLayout`/`styleInjector.switchPage`/`document.title` 을 갱신하는데 이동이 이미 B 로 대체된 뒤에도 실행된다. A(layout alt, 느림) -> B(default) 연속 이동 시 URL 은 B, 레이아웃은 alt, title 은 A.
   재현: `test/e2e/basic/routing.spec.js` "빠른 연속 이동 ..." (`test.fixme`, `VZ_RUN_FIXME=1 pnpm test:basic` 로 실행).
