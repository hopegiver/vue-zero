# vue-zero

Zero-build Vue 3 router for AI-driven development.

- AI only needs standard Vue 3 knowledge — no special syntax to learn
- No build step — runs directly in the browser
- Nuxt-style file-based routing — conventions AI already knows

## Quick Start

```html
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/vue-router@4/dist/vue-router.global.prod.js"></script>
<script src="https://unpkg.com/vue-ai-first/dist/vue-zero.js"></script>

<div id="app"></div>
<script>
  VueZero.createApp()
</script>
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

**Auth guard** — Protect pages with `requiresAuth: true`. Built-in JWT support.

**Page titles** — Set `title: 'My Page'` and `document.title` updates on navigation.

## Page Example

```vue
<template>
  <div>
    <h1>{{ heading }}</h1>
    <ul>
      <li v-for="user in users" :key="user.id">{{ user.name }}</li>
    </ul>
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
  api/              # Hono backend
    index.js
    routes/
    dao/
  app/              # vue-zero frontend
    index.html
    pages/
    components/
    layouts/
```

```toml
# wrangler.toml
name = "my-app"
main = "api/index.js"

[assets]
directory = "./app"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]
```

## Options

```js
VueZero.createApp({
  pagesDir: 'pages',         // default
  componentsDir: 'components', // default
  layoutsDir: 'layouts',      // default
  auth: {
    enabled: true,
    loginPage: '/login',
  }
})
```

## Rules for AI

1. **Register files** — Add pages to `pages/pages.json`, components to `components/components.json` (without `.vue` extension)
2. **Options API only** — No `<script setup>`, no Composition API, no TypeScript
3. **No `<style scoped>`** — Use class names for style isolation
4. **404 page** — `pages/404.vue` is auto-detected. Do NOT add it to `pages.json`

## License

[MIT](LICENSE)
