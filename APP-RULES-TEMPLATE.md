---
description: vue-zero 앱 개발 규칙
---

# vue-zero 규칙

## 절대 금지

- `<script setup>` → Options API만 (`export default { ... }`)
- `<style scoped>` → `<style>`만, 클래스명으로 구분
- TypeScript → 순수 JS만

## 파일 등록

`.vue` 또는 `server/api/*.js` 추가/삭제 후 `npm run scan`. Claude Code hook 시 자동.

- `pages/404.vue`는 pages.json에 등록하지 않음

## .vue 옵션

```js
export default {
  title: '페이지 제목',   // document.title (선택)
  layout: 'admin',        // 생략 시 default, false면 없음
  requiresAuth: true,     // 인증 필요 시 (선택)
}
```

## API 추가

1. `server/dao/X.js` — `export default class XDao { constructor(env) {...} findAll() {...} }`
2. `server/api/X.js` — Hono 라우터, `new XDao(c.env)`, `notFound/badRequest` 헬퍼 사용

scan이 `_registry.js` 자동 생성. `server/index.js` 수정 불필요.
