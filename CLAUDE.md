# vue-zero — 라이브러리 패키지

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
├── build.js                     # esbuild 빌드 + ../template/app/dist/ 자동 복사
├── package.json
└── README.md
```

## 개발 명령어

```bash
npm run dev      # 빌드 watch 모드 (파일 변경 시 자동 빌드 + template에 복사)
npm run build    # 배포용 단일 파일 빌드
```

빌드 시 `../template/app/dist/vue-zero.js`에 자동 복사됩니다.
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

## 구현 규칙

- **빌드 결과물**: `dist/vue-zero.js` 단일 파일만. `.d.ts`, `.map` 등 생성 금지
- **에러 처리**: 브라우저 콘솔에 명확한 에러 메시지 출력
- **의존성 없음**: Vue 3 외 런타임 의존성 금지
- **주석 최소화**: 코드가 자명하면 주석 생략
- **CSP**: Blob URL + dynamic import 사용. `unsafe-eval` 의존 금지

## npm 배포

```bash
npm run build
npm publish
```
