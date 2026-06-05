# [앱 이름] - AI 개발 가이드

> 이 파일은 vue-zero 기반 앱 프로젝트의 CLAUDE.md 템플릿입니다.
> 프로젝트 루트에 CLAUDE.md로 복사하고 [ ] 항목을 채워서 사용하세요.

---

## 프로젝트 개요

[앱의 목적과 주요 기능을 2-3줄로 작성]

예시:
> 사내 HR 어드민 시스템. 직원 정보 관리, 근태 조회, 급여 명세 확인 기능을 제공한다.
> 사용자는 HR 담당자와 일반 직원 두 종류다.

## 기술 스택

- 프론트엔드: vue-zero (Vue 3 Options API, 제로빌드)
- 백엔드: Hono + Cloudflare Workers
- 배포: Cloudflare (wrangler deploy)

## 폴더 구조

```
[프로젝트명]/
├── wrangler.toml
├── api/                      # 백엔드 (Hono + Cloudflare Workers)
│   ├── index.js              # Hono 앱 진입점 — 라우터 등록
│   ├── middleware/
│   │   └── auth.js           # JWT 검증 미들웨어 + signJwt
│   ├── routes/               # HTTP 엔드포인트 정의
│   │   └── auth.js           # POST /api/auth/login, /logout
│   ├── dao/                  # 데이터 접근 (DB 쿼리, KV 읽기/쓰기)
│   └── utils/
│       └── response.js       # ok / notFound / badRequest / unauthorized / serverError
└── app/                      # 프론트엔드 (vue-zero)
    ├── index.html
    ├── pages/
    │   └── pages.json
    ├── components/
    │   └── components.json
    ├── layouts/
    └── composables/
```

## 개발 명령어

```bash
wrangler dev     # 로컬 개발 (http://localhost:8787)
wrangler deploy  # 프로덕션 배포
```

---

## vue-zero 필수 규칙

### 규칙 1 — 파일을 만들면 JSON에 등록 ⚠️ 가장 흔한 실수

**`.vue` 파일 생성과 JSON 등록은 항상 함께 해야 한다. 등록하지 않으면 동작하지 않는다.**

- `pages/`에 `.vue`를 만들면 → `pages/pages.json`에 이름 추가 (확장자 없이)
- `components/`에 `.vue`를 만들면 → `components/components.json`에 이름 추가
- `.vue`를 삭제하면 → JSON에서도 반드시 제거

```json
// pages/pages.json
["index", "about", "users/index", "users/[id]"]

// components/components.json
["AppButton", "UserCard"]
```

### 규칙 2 — 레이아웃

`layouts/default.vue`가 있으면 모든 페이지에 자동 적용된다.

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <nav>네비게이션</nav>
    <slot />
  </div>
</template>
```

페이지별로 레이아웃을 바꾸려면 `layout` 옵션을 지정한다:

```vue
<script>
export default {
  layout: 'admin',  // layouts/admin.vue 사용
  layout: false,    // 레이아웃 없음 (로그인 페이지 등)
}
</script>
```

### 규칙 3 — 404 페이지

`pages/404.vue` 파일이 있으면 자동으로 catch-all로 등록된다. **pages.json에 추가하지 않는다.**

### 규칙 4 — 페이지 title

```vue
<script>
export default {
  title: '사용자 목록',  // document.title 자동 설정
  data() {
    return { heading: '사용자 목록' }  // 템플릿 출력은 별도 변수 사용
  }
}
</script>
```

### 규칙 5 — `<style scoped>` 사용 금지

`<style>`만 사용. 클래스명으로 충돌을 방지한다.

```vue
<style>
.page-users h1 { color: blue; }   /* 페이지는 .page-[이름] */
.card-user h2 { font-size: 1rem; } /* 컴포넌트는 .컴포넌트명 */
</style>
```

### 규칙 6 — composables는 직접 import

```js
import { useUsers } from '/composables/useUsers.js'
```

### 규칙 7 — Options API만 사용

`<script setup>`, TypeScript, Composition API 사용 금지.
표준 Vue 3 Options API만 사용한다.

```vue
<script>
export default {
  data() { return {} },
  computed: {},
  methods: {},
  mounted() {},
}
</script>
```

---

## 현재 페이지 목록

> pages/pages.json과 항상 동기화해서 유지한다.

```json
[
  "index"
]
```

| 페이지 | 경로 | 설명 | 인증 필요 | 레이아웃 |
|--------|------|------|-----------|----------|
| index  | /    | 홈   | 아니오    | default  |

## 현재 컴포넌트 목록

> components/components.json과 항상 동기화해서 유지한다.

```json
[]
```

| 컴포넌트 | 설명 |
|----------|------|
| -        | -    |

## 현재 레이아웃 목록

| 레이아웃 | 파일 | 설명 |
|----------|------|------|
| default  | layouts/default.vue | 기본 레이아웃 |

---

## API 엔드포인트

> 백엔드 API 목록. 새 엔드포인트 추가 시 여기에 함께 기록한다.

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET    | /api/health | 헬스체크 | 불필요 |

### 인증이 필요한 엔드포인트 패턴

```js
import { authMiddleware } from '../middleware/auth.js'

// authMiddleware를 핸들러 앞에 추가하면 끝
router.get('/me', authMiddleware, (c) => {
  const user = c.get('user')  // { sub, email, role }
  return c.json({ user })
})
```

프론트엔드에서 API 호출 시 헤더 포함:

```js
// composables/useApi.js 패턴
const res = await fetch('/api/users', {
  headers: { Authorization: `Bearer ${localStorage.token}` }
})
```

### 새 API 추가 패턴

엔드포인트를 추가할 때는 아래 3단계를 순서대로 진행한다.

**1. `api/dao/[리소스].js` 생성 — 데이터 접근 함수**

```js
// api/dao/posts.js
export function findAll() { return [] }
export function findById(id) { return null }
export function create(data) { return { id: 1, ...data } }
```

**2. `api/routes/[리소스].js` 생성 — 엔드포인트 정의**

```js
// api/routes/posts.js
import { Hono } from 'hono'
import * as postsDao from '../dao/posts.js'
import { notFound, badRequest } from '../utils/response.js'

const router = new Hono()

router.get('/', (c) => c.json({ posts: postsDao.findAll() }))
router.get('/:id', (c) => {
  const post = postsDao.findById(c.req.param('id'))
  if (!post) return notFound(c)
  return c.json({ post })
})
router.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.title) return badRequest(c, 'title is required')
  return c.json({ post: postsDao.create(body) }, 201)
})

export default router
```

**3. `api/index.js`에 라우터 등록**

```js
import postsRouter from './routes/posts.js'
app.route('/api/posts', postsRouter)
```

## 인증

> 인증을 사용하지 않으면 이 섹션을 삭제한다.

```js
// app/index.html
VueZero.createApp({
  auth: {
    enabled: true,
    loginPage: '/login',
  }
})
```

- 토큰 저장: `localStorage.token` (JWT)
- 보호 페이지: 해당 `.vue` 파일에 `requiresAuth: true` 선언

---

## 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 페이지 파일 | kebab-case | `user-detail.vue` |
| 컴포넌트 파일 | PascalCase | `UserCard.vue` |
| 컴포넌트 등록명 | PascalCase | `"UserCard"` |
| CSS 클래스 (페이지) | `.page-[파일명]` | `.page-user-detail` |
| CSS 클래스 (컴포넌트) | `.컴포넌트명` | `.user-card` |
| composable 파일 | camelCase | `useUsers.js` |

## 외부 라이브러리

> 사용 중인 CDN 라이브러리 목록. app/index.html의 순서와 일치해야 한다.

| 라이브러리 | 용도 | CDN |
|-----------|------|-----|
| Vue 3 | 프레임워크 | unpkg.com/vue@3/dist/vue.global.js |
| Vue Router 4 | 라우터 | unpkg.com/vue-router@4/dist/vue-router.global.js |
| vue-zero | 라우터 자동화 | unpkg.com/vue-zero/dist/vue-zero.js |
