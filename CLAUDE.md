# vue-zero - Development Guide

## Project Overview

**vue-zero**는 AI 개발을 위한 제로빌드 Vue 3 라우터입니다.

- AI가 Vue 3 표준 문법만 알면 바로 사용 가능
- 빌드 없음, 설정 없음, CDN 한 줄로 설치
- Nuxt와 동일한 폴더 구조 — AI가 이미 알고 있는 컨벤션 그대로

## 핵심 철학 (절대 원칙)

### 1. 제로빌드
- 앱 개발자는 빌드 스텝이 없다 — 브라우저에서 직접 실행
- `dist/vue-zero.js` 한 파일만 CDN으로 제공. `.d.ts` 등 부산물 없음
- vue-zero 라이브러리 자체는 `npm run build`(esbuild)로 빌드하지만, 그 결과물은 `dist/vue-zero.js` 단일 파일뿐

### 2. AI가 특별한 학습 없이 빠르고 정확하게, 실수 없이 작업할 수 있다
- Vue 3 Options API 표준 문법만 사용 — vue-zero 전용 문법/매크로/특수 기능 금지
- `<script setup>`, TypeScript, Composition API 지원 안 함 — AI가 이미 아는 가장 단순한 형태만
- Nuxt와 동일한 폴더 구조 — AI가 이미 학습한 컨벤션 그대로
- 새 기능 추가 기준: "AI가 Vue 표준 지식만으로 이 기능을 쓸 수 있는가?" — NO면 추가하지 않음

## vue-zero 내부 구조 (라이브러리 코드)

```
src/
├── vue-zero.ts              # 메인 진입점 — createApp() 단일 API
├── core/
│   ├── SfcParser.ts         # .vue 파일 fetch → template/script/style 분리
│   ├── RouteScanner.ts      # pages/ 스캔 → 라우트 자동 등록
│   ├── ComponentLoader.ts   # components/ 스캔 → 전역 컴포넌트 자동 등록
│   └── AuthGuard.ts         # JWT 기반 경량 인증 가드
└── utils/
    └── StyleInjector.ts     # <style> 블록 → DOM <style> 태그 주입
```

## 사용자 앱 폴더 구조

Cloudflare Workers 기반 풀스택 구조가 표준입니다.

```
my-app/
├── wrangler.toml            # Cloudflare Workers 설정
├── api/                     # 백엔드 (Cloudflare Workers)
│   └── index.js             # fetch 핸들러, /api/* 라우팅
└── app/                     # 프론트엔드 (vue-zero)
    ├── index.html           # vue-zero CDN + createApp() 호출
    ├── pages/               # 라우팅 자동 등록
    │   ├── index.vue        → /
    │   ├── about.vue        → /about
    │   └── users/
    │       ├── index.vue    → /users
    │       ├── [id].vue     → /users/:id        (동적 라우트)
    │       └── [id]/
    │           └── posts.vue → /users/:id/posts (중첩 동적 라우트)
    ├── components/          # 전역 컴포넌트 자동 등록
    │   ├── components.json  # ["AppButton", "UserCard"]
    │   ├── AppButton.vue
    │   └── UserCard.vue
    ├── layouts/             # 레이아웃 래퍼
    │   └── default.vue      # 기본 레이아웃
    └── composables/         # 공통 로직 (표준 JS 모듈)
        └── useUsers.js
```

## wrangler.toml 기본 설정

```toml
name = "my-app"
main = "api/index.js"
compatibility_date = "2024-01-01"

[assets]
directory = "./app"
```

## api/ 폴더 구조

Hono 기반 3-레이어 구조가 표준입니다.

```
api/
├── index.js          # Hono 앱 진입점 — 라우터 등록
├── routes/           # HTTP 엔드포인트 정의
│   └── users.js
├── dao/              # 데이터 접근 (DB 쿼리, KV 읽기/쓰기)
│   └── users.js
└── utils/
    └── response.js   # ok / notFound / badRequest / serverError 헬퍼
```

### api/index.js

```js
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import usersRouter from './routes/users.js'

const app = new Hono()

app.use('/api/*', cors())
app.route('/api/users', usersRouter)

export default app
```

### api/routes/users.js

```js
import { Hono } from 'hono'
import * as usersDao from '../dao/users.js'
import { notFound } from '../utils/response.js'

const router = new Hono()

router.get('/', (c) => {
  return c.json({ users: usersDao.findAll() })
})

router.get('/:id', (c) => {
  const user = usersDao.findById(c.req.param('id'))
  if (!user) return notFound(c)
  return c.json({ user })
})

export default router
```

### api/dao/users.js

```js
export function findAll() {
  return []
}

export function findById(id) {
  return null
}
```

### api/utils/response.js

```js
export const ok = (c, data) => c.json(data)
export const notFound = (c, msg = 'Not found') => c.json({ error: msg }, 404)
export const badRequest = (c, msg = 'Bad request') => c.json({ error: msg }, 400)
export const serverError = (c, msg = 'Internal server error') => c.json({ error: msg }, 500)
```

## 동적 라우트 파일명 규칙 (Nuxt 동일)

| 파일 경로 | 라우트 경로 |
|-----------|-------------|
| `pages/index.vue` | `/` |
| `pages/about.vue` | `/about` |
| `pages/users/index.vue` | `/users` |
| `pages/users/[id].vue` | `/users/:id` |
| `pages/users/[id]/posts.vue` | `/users/:id/posts` |
| `pages/[...slug].vue` | `/:slug*` (catch-all) |

### 페이지에서 파라미터 접근

```vue
<script>
export default {
  mounted() {
    // 표준 Vue Router 방식 그대로
    const id = this.$route.params.id
    const query = this.$route.query.tab
  }
}
</script>
```

## AI가 반드시 알아야 할 vue-zero 전용 규칙

Vue 3 표준과 다른 점은 이것뿐이다. 나머지는 Vue 3 표준 그대로.

### 규칙 1 — 파일을 만들면 JSON에 등록 ⚠️ 가장 흔한 실수

**`.vue` 파일 생성과 JSON 등록은 항상 함께 해야 한다. 파일만 만들면 동작하지 않는다.**

- `pages/`에 `.vue`를 만들면 → `pages/pages.json`에 이름 추가
- `components/`에 `.vue`를 만들면 → `components/components.json`에 이름 추가
- `.vue`를 삭제하면 → JSON에서도 반드시 제거

등록 누락 시 브라우저 콘솔에 경고가 출력된다.

```json
// pages/pages.json — contact.vue 추가 후 반드시 함께 업데이트
["index", "about", "contact"]
```

### 규칙 2 — 레이아웃

`layouts/default.vue`가 있으면 모든 페이지에 자동 적용. 레이아웃 안에 `<slot />`이 있어야 페이지 내용이 들어간다.

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <nav>네비게이션</nav>
    <slot />
  </div>
</template>
```

특정 페이지에 다른 레이아웃을 쓰려면 `layout` 옵션을 지정한다 (vue-zero 전용 옵션):

```vue
<script>
export default {
  layout: 'admin',  // layouts/admin.vue 사용. 없으면 default.vue
  data() { ... }
}
</script>
```

레이아웃 없이 렌더링하려면 `layout: false`:

```vue
<script>
export default {
  layout: false,  // 레이아웃 적용 안 함 (로그인 페이지 등)
  data() { ... }
}
</script>
```

### 규칙 3 — 404 페이지

`pages/404.vue` 파일이 있으면 존재하지 않는 경로에서 자동으로 표시된다. **pages.json에 등록하지 않는다.**

```vue
<!-- pages/404.vue — pages.json에 추가하지 말 것 -->
<template>
  <div>
    <h1>페이지를 찾을 수 없습니다</h1>
    <a href="/">홈으로</a>
  </div>
</template>
```

### 규칙 4 — 페이지 title 설정

페이지 컴포넌트에 `title` 옵션을 지정하면 라우팅 시 `document.title`이 자동으로 바뀐다.

```vue
<script>
export default {
  title: '사용자 목록',  // 이 페이지로 이동 시 document.title = '사용자 목록'
  data() { ... }
}
</script>
```

`title`이 없으면 이전 페이지의 title이 유지된다.

⚠️ `data()`에 `title`을 동시에 쓰면 템플릿의 `{{ title }}`은 `data.title`을 가리킨다. `document.title`과 화면 출력을 분리해서 쓰는 것이 좋다.

```vue
<script>
export default {
  title: '사용자 목록',       // document.title
  data() {
    return { heading: '사용자 목록' }  // 템플릿에서 {{ heading }} 으로 사용
  }
}
</script>
```

### 규칙 5 — `<style scoped>` 동작 안 함

vue-zero는 `scoped`를 지원하지 않는다. `<style>`만 사용. 충돌 방지는 클래스명으로 직접 구분한다.

```vue
<!-- 이렇게 쓰면 안 됨 -->
<style scoped>
h1 { color: blue; }
</style>

<!-- 이렇게 써야 함 -->
<style>
.page-users h1 { color: blue; }
</style>
```

### 규칙 6 — composables/는 vue-zero가 자동 등록하지 않는다

`composables/` 폴더는 표준 JS 모듈이다. 직접 import해서 써야 한다.

```js
// pages/users.vue
import { useUsers } from '/composables/useUsers.js'
```

---

## app/index.html 최소 설정

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/vue-router@4/dist/vue-router.global.js"></script>
  <script src="https://unpkg.com/vue-zero/dist/vue-zero.js"></script>
</head>
<body>
  <div id="app"></div>
  <script>
    VueZero.createApp()
    // 기본값: pages/, components/, layouts/ (index.html 기준 상대경로)
  </script>
</body>
</html>
```

## .vue 파일 형식 (Options API만 지원)

```vue
<template>
  <div>
    <h1>{{ title }}</h1>
    <AppButton @click="load">불러오기</AppButton>
  </div>
</template>

<script>
export default {
  data() {
    return { title: 'Hello' }
  },
  async mounted() {
    const res = await fetch('/api/data')
    this.data = await res.json()
  },
  methods: {
    load() {}
  }
}
</script>

<style>
.page-example h1 { color: blue; }
</style>
```

## 페이지와 컴포넌트 등록

페이지와 컴포넌트는 각각 JSON 파일에 선언한다. **확장자 없이**.

```json
// pages/pages.json
["index", "about", "users/index", "users/[id]"]
```

```json
// components/components.json
["AppButton", "UserCard"]
```

파일을 추가하거나 삭제할 때 이 JSON 파일을 함께 업데이트한다.

## createApp 옵션

기본값(`pages`, `components`, `layouts`)을 쓴다면 `createApp()`을 인수 없이 호출한다.

```js
VueZero.createApp()
```

경로는 `index.html` 기준 상대경로다. 폴더 구조가 다를 때만 추가한다.

```js
VueZero.createApp({
  pagesDir: 'app/pages',
})
```

인증은 `enabled: true` 필수. 보호할 페이지는 여기가 아니라 페이지 파일에서 선언한다.

```js
VueZero.createApp({
  auth: {
    enabled: true,
    loginPage: '/login',
  }
})
```

```vue
<!-- pages/dashboard.vue — 보호할 페이지에서 직접 선언 -->
<script>
export default {
  requiresAuth: true,
  data() { ... }
}
</script>
```

## 외부 라이브러리 연동 (CDN)

vue-zero는 이 라이브러리들을 내장하지 않음. 필요 시 CDN으로 직접 추가:

```html
<!-- 상태관리: Pinia -->
<script src="https://unpkg.com/pinia/dist/pinia.iife.js"></script>
```

## 개발 명령어

```bash
# vue-zero 라이브러리 개발
npm run dev      # 빌드 watch 모드
npm run build    # 배포용 단일 파일 빌드 (dist/vue-zero.js)
npm run serve    # examples/ 로컬 서버

# 사용자 앱 개발 (Cloudflare Workers)
wrangler dev     # 프론트+백엔드 동시 로컬 개발 (http://localhost:8787)
wrangler deploy  # 프로덕션 배포
```

## 구현 규칙

- **빌드 결과물**: `dist/vue-zero.js` 단일 파일만. `.d.ts`, `.map` 등 생성 금지
- **에러 처리**: 브라우저 콘솔에 명확한 에러 메시지 출력 (파일 못 찾음, 파싱 실패 등)
- **의존성 없음**: Vue 3 외 런타임 의존성 금지
- **주석 최소화**: 코드가 자명하면 주석 생략

## 검증 방법

1. `npm run serve` 로 로컬 서버 실행
2. `examples/index.html` 브라우저에서 열기
3. `/#/`, `/#/about`, `/#/users` hash 라우팅 확인
4. `components/` 자동 등록 컴포넌트가 페이지에서 동작하는지 확인
5. `layouts/default.vue` 가 모든 페이지에 적용되는지 확인
6. 브라우저 콘솔 에러 없음 확인
