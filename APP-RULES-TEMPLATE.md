---
description: vue-zero 앱 개발 규칙 — 파일 등록, 컴포넌트 작성, API 패턴
---

# vue-zero 규칙

## 절대 금지

- `<script setup>` 금지 → `export default { ... }` Options API만
- `<style scoped>` 금지 → `<style>`만, 클래스명으로 스코프 구분
- TypeScript 금지 → 순수 JS만

## 파일 만들면 JSON 등록 필수 ⚠️

파일 생성/삭제와 JSON 업데이트는 **항상 같은 작업**이다.

| 파일 위치 | 등록 파일 | 등록 형식 |
|-----------|-----------|-----------|
| `pages/foo.vue` | `pages/pages.json` | `"foo"` (확장자 없이) |
| `pages/users/[id].vue` | `pages/pages.json` | `"users/[id]"` |
| `components/MyCard.vue` | `components/components.json` | `"MyCard"` |
| `pages/404.vue` | **등록하지 않음** | — |

## .vue 파일 형식

```vue
<template>
  <div class="page-foo">...</div>
</template>

<script>
export default {
  title: '페이지 제목',        // document.title (선택)
  layout: 'default',           // 생략 시 default.vue, false면 레이아웃 없음
  requiresAuth: true,          // 인증 필요 시 (선택)
  data() { return {} },
  computed: {},
  methods: {},
  async mounted() {},
}
</script>

<style>
.page-foo h1 { }   /* 페이지: .page-[파일명] */
.my-card h2 { }    /* 컴포넌트: .컴포넌트명 kebab */
</style>
```

## composables는 직접 import

```js
import { useUsers } from '/composables/useUsers.js'  // 자동 등록 없음
```

## API 추가 순서

1. `api/dao/[리소스].js` — DB/KV 접근 함수
2. `api/routes/[리소스].js` — Hono 엔드포인트
3. `api/index.js` — `app.route('/api/[리소스]', router)` 등록

```js
// response 헬퍼 항상 사용
import { ok, notFound, badRequest, unauthorized } from '../utils/response.js'
```

## 인증이 필요한 API

```js
import { authMiddleware } from '../middleware/auth.js'
router.get('/me', authMiddleware, (c) => {
  const user = c.get('user')  // { sub, email, role }
  return c.json({ user })
})
```

프론트에서 호출 시:

```js
fetch('/api/foo', { headers: { Authorization: `Bearer ${localStorage.token}` } })
```
