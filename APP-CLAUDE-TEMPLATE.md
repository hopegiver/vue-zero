# [앱 이름] - AI 개발 가이드

> vue-zero 기반 앱의 CLAUDE.md 템플릿. 프로젝트 루트에 CLAUDE.md로 복사하고 [ ] 항목을 채워서 사용.

## 프로젝트 개요

[앱의 목적과 주요 기능을 2-3줄로 작성]

## 기술 스택

- 프론트엔드: vue-zero (Vue 3 Options API, 제로빌드)
- 백엔드: Hono + Cloudflare Workers
- 배포: Cloudflare (`wrangler deploy`)

## 폴더 구조

```
[프로젝트명]/
├── wrangler.toml
├── server/                   # 백엔드 (Nuxt 동일 구조)
│   ├── index.js              # 안정 파일 — 수정 불필요
│   ├── _registry.js          # scan 자동 생성 — 편집 금지
│   ├── middleware/auth.js     # JWT 미들웨어 + signJwt
│   ├── api/                  # 엔드포인트 — 파일 추가 시 scan이 자동 등록
│   ├── dao/                  # 데이터 접근 — 여러 api에서 재조합
│   └── utils/response.js     # notFound / badRequest / unauthorized / serverError
└── app/                      # 프론트엔드 (vue-zero)
    ├── index.html
    ├── pages/                # pages.json으로 라우트 자동 등록
    ├── components/           # components.json으로 전역 등록
    ├── layouts/
    └── composables/
```

## 개발 명령어

```bash
wrangler dev     # 로컬 개발 (http://localhost:8787)
wrangler deploy  # 프로덕션 배포
npm run scan     # pages.json, components.json, _registry.js 갱신
```

---

## vue-zero 규칙

### 규칙 1 — 파일 등록은 scan이 자동 처리

`.vue` 또는 `server/api/*.js` 파일을 추가/삭제하면 `npm run scan` 실행.
Claude Code 사용 시 hook이 자동 실행하므로 수동 실행 불필요.

### 규칙 2 — Options API만, scoped 금지

`<script setup>`, TypeScript, Composition API 사용 금지. `<style scoped>` 금지 — 클래스명으로 구분.

### 규칙 3 — 레이아웃

`layouts/default.vue` → 모든 페이지에 자동 적용. `layout: 'admin'` 또는 `layout: false`로 페이지별 변경.

### 규칙 4 — 404, title, composables

- `pages/404.vue` → 자동 catch-all. pages.json에 등록하지 않음
- `title: '페이지명'` → document.title 자동 설정
- `composables/` → 자동 등록 없음, 직접 import

---

## API 추가 패턴

2단계로 추가. scan이 `server/_registry.js`를 자동 생성하므로 `server/index.js` 수정 불필요.

**1. `server/dao/[리소스].js` — DAO 클래스**

```js
export default class PostsDao {
  constructor(env) { this.env = env }
  findAll() { return [] }
  findById(id) { return null }
}
```

**2. `server/api/[리소스].js` — 엔드포인트**

```js
import { Hono } from 'hono'
import PostsDao from '../dao/posts.js'
import { notFound } from '../utils/response.js'

const router = new Hono()

router.get('/', (c) => {
  const dao = new PostsDao(c.env)
  return c.json({ posts: dao.findAll() })
})

router.get('/:id', (c) => {
  const dao = new PostsDao(c.env)
  const post = dao.findById(c.req.param('id'))
  if (!post) return notFound(c)
  return c.json({ post })
})

export default router
```

## 인증

> 인증 미사용 시 이 섹션 삭제.

```js
VueZero.createApp({ auth: { enabled: true, loginPage: '/login' } })
```

- 보호 페이지: `.vue`에 `requiresAuth: true`
- API 보호: `router.get('/me', authMiddleware, handler)`
- 토큰: `localStorage.token` (JWT), 요청 시 `Authorization: Bearer <token>`

## 외부 라이브러리

| 라이브러리 | CDN |
|-----------|-----|
| Vue 3 | unpkg.com/vue@3/dist/vue.global.prod.js |
| Vue Router 4 | unpkg.com/vue-router@4/dist/vue-router.global.prod.js |
| vue-zero | unpkg.com/vue-ai-first/dist/vue-zero.js |
