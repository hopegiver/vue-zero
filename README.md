# vue-zero

Zero-build Vue 3 router for AI-driven development.

- AI only needs standard Vue 3 knowledge — no special syntax to learn
- No build step — runs directly in the browser via CDN
- Nuxt-style file-based routing — conventions AI already knows
- Bootstrap 5 + Notion-inspired design system out of the box
- Cloudflare Workers full-stack ready

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="/assets/css/base.css" rel="stylesheet">
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script src="https://unpkg.com/vue-router@4/dist/vue-router.global.prod.js"></script>
  <script src="https://unpkg.com/vue-ai-first/dist/vue-zero.js"></script>
</head>
<body>
  <div id="app"></div>
  <script>
    VueZero.createApp()
  </script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
```

Create `.vue` files in `pages/` and they become routes automatically:

```
pages/
  index.vue        → /
  about.vue        → /about
  users/
    index.vue      → /users
    [id].vue       → /users/:id
```

## How It Works

1. List your pages in `pages/pages.json`: `["index", "about", "users/index", "users/[id]"]`
2. Write standard Vue 3 Options API `.vue` files
3. That's it. No build, no config, no CLI.

## Features

**File-based routing** — Nuxt-style dynamic routes, catch-all routes, nested routes.

**Auto components** — Put `.vue` files in `components/` and list them in `components/components.json`. They're globally available in all pages.

**Layouts** — `layouts/default.vue` wraps all pages. Use `layout: 'admin'` or `layout: false` per page.

**Auth guard** — When `auth.enabled: true`, all pages are protected by default. Mark public pages with `auth: false`. Built-in JWT support.

**Page titles** — Set `title: 'My Page'` and `document.title` updates on navigation.

**Design system** — Bootstrap 5 base with Notion-inspired `base.css` tokens (colors, typography, spacing, shadows). All rem-based for consistent scaling.

**CSP friendly** — Script evaluation uses Blob URL + dynamic import instead of `eval`/`new Function`. No `unsafe-eval` required.

## Page Example

```vue
<template>
  <div class="container py-4">
    <h1 class="mb-3">{{ heading }}</h1>
    <div class="card p-4">
      <ul class="list-unstyled mb-0">
        <li v-for="user in users" :key="user.id" class="py-2 border-bottom">
          <router-link :to="'/users/' + user.id">{{ user.name }}</router-link>
          <span class="text-muted small ms-2">{{ user.email }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  title: 'Users',
  data() {
    return { heading: 'Users', users: [] }
  },
  async mounted() {
    const res = await fetch('/api/users')
    const data = await res.json()
    this.users = data.users
  }
}
</script>
```

## Full-Stack with Cloudflare Workers

vue-zero pairs with [Hono](https://hono.dev) on Cloudflare Workers for a complete full-stack setup:

```
my-app/
  wrangler.toml
  server/             # Hono backend
    index.js
    api/
    dao/
    middleware/
    utils/
  app/                # vue-zero frontend
    index.html
    pages/
    components/
    layouts/
    assets/css/
```

```toml
# wrangler.toml
name = "my-app"
main = "server/index.js"
compatibility_date = "2024-01-01"

[assets]
directory = "./app"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]
```

## Options

```js
VueZero.createApp({
  pagesDir: 'pages',           // default
  componentsDir: 'components', // default
  layoutsDir: 'layouts',       // default
  auth: {
    enabled: true,
    loginPage: '/login',
  }
})
```

## Rules for AI

1. **Register files** — Add pages to `pages/pages.json`, components to `components/components.json` (without `.vue` extension). Or run `npm run scan`.
2. **Options API only** — No `<script setup>`, no Composition API, no TypeScript
3. **No `<style scoped>`** — Use Bootstrap classes + `base.css` tokens. Use class names for isolation when needed.
4. **404 page** — `pages/404.vue` is auto-detected. Do NOT add it to `pages.json`

## License

[MIT](LICENSE)
