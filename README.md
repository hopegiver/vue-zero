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
  <script src="https://unpkg.com/vue-zero-ai/dist/vue-zero.js"></script>
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

**Auto components** — Put `.vue` files in `components/` and list them in `components/components.json`. They're globally available in all pages and are loaded lazily — only the components a page (or layout) actually uses are fetched when that page opens.

**Layouts** — `layouts/default.vue` wraps all pages. Use `layout: 'admin'` or `layout: false` per page.

**Auth guard** — When `auth.enabled: true`, all pages are protected by default. Mark public pages with `auth: false`. Built-in JWT support.

**Page titles** — Set `title: 'My Page'` and `document.title` updates on navigation.

**Error page** — `pages/error.vue` is auto-detected and rendered when a page fails to load (fetch or script errors).

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

## Errors and Diagnostics

Every problem vue-zero detects is reported once in a fixed format, both in the console and in a ring buffer an AI (or a test) can read:

```
[vue-zero] E_SCRIPT_SETUP /pages/foo.vue — script eval failed: Failed to resolve module specifier "vue"
hint: No <script setup>/Composition API/import. Use <script>export default { ... }</script> (Options API); Vue is global
```

```js
VueZero.version   // "x.y.z" — package.json version, injected at build time
VueZero.errors()  // copy of the last 50 reports, oldest first:
// [{ code, stage, file, line?, message, hint, level: 'error'|'warn', time }]
```

`stage` is one of `load | parse | eval | render | route | auth | manifest | config`. Entries hold paths and HTTP status only — never tokens, query strings or user data. Runtime errors carry the real `.vue` file and line (`/pages/foo.vue:12`): scripts are evaluated with a `sourceURL` and line-aligned, so stack traces in the browser DevTools point at the `.vue` file too.

| Code | Level | Stage | Meaning / fix |
|------|-------|-------|---------------|
| `E_SCRIPT_SETUP` | error | eval | `<script setup>`, Composition API or `import ... from 'vue'`. Use an Options API `export default {}` |
| `E_RELATIVE_IMPORT` | error | eval | Any `import` in a `.vue` script (scripts run as Blob URLs). Remove it; use globals |
| `E_SCRIPT_TS` | error | eval | `lang="ts"` / type annotations. Plain JavaScript only |
| `E_SCRIPT_EVAL` | error | eval | Other syntax / top-level error in `<script>` |
| `E_PAGE_FETCH` / `E_LAYOUT_FETCH` / `E_COMPONENT_FETCH` | error | load | `.vue` fetch failed (HTTP status or network). 404: file missing or not in `pages.json`/`components.json` |
| `E_PAGE_LOAD`, `E_COMPONENT_LOAD`, `E_ERROR_PAGE` | error | load | Other failure while loading a page / component / `error.vue` |
| `E_LAYOUT_NOT_FOUND` | warn | load | Layout file is 404: the page renders without a layout (only 404 is cached; 5xx/network errors are retried on the next navigation) |
| `E_RENDER` | error | render | Template render threw (undefined/null data, computed or prop) |
| `E_RUNTIME` | error | render | Hook / method / event handler threw. See `file:line` |
| `E_VUE_WARN` | warn | render | Vue development-build warning (needs `vue.global.js`, not `.prod.js`) |
| `E_STYLE_SCOPED` | warn | parse | `<style scoped>` is not supported; the style is applied globally |
| `E_RESERVED_TAG` | error | manifest | `pages.json` has a page named like an HTML tag (`table`, `div`, ...). Rename it. Checked at startup |
| `E_MANIFEST_ENTRY` | error | manifest | `pages.json` entry ends with `.vue` |
| `E_MANIFEST_MISSING`, `E_NO_PAGES` | warn | manifest | `pages.json` missing / empty |
| `E_LOGIN_PAGE_PROTECTED` | error | auth | `loginPage` points at a protected page (no `auth: false`), which would redirect forever. Add `auth: false`; the page is treated as public meanwhile |
| `E_LOGIN_PAGE_MISSING` | error | auth | `loginPage` matches no page and the 404 page is protected |
| `E_ROUTE` | error | route | Unexpected exception during navigation |
| `E_OPTION_INVALID`, `E_AUTH_CONFIG` | error / warn | config | Invalid `createApp` option |

During development, load the Vue **development** build (`vue.global.js`) instead of `vue.global.prod.js`: with the prod build Vue hides template warnings (unknown components, undefined properties). On `localhost`, vue-zero prints a one-time `console.info` when it detects the prod build.

## Rules for AI

1. **Register files** — Add pages to `pages/pages.json`, components to `components/components.json` (without `.vue` extension). Or run `npm run scan`.
2. **Options API only** — No `<script setup>`, no Composition API, no TypeScript
3. **No `<style scoped>`** — Use Bootstrap classes + `base.css` tokens. Use class names for isolation when needed.
4. **404 page** — `pages/404.vue` is auto-detected. Do NOT add it to `pages.json`
5. **Error page** — `pages/error.vue` is auto-detected. Do NOT add it to `pages.json`

## License

[MIT](LICENSE)
