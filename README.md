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

**Auth guard** — When `auth.enabled: true`, all pages are protected by default. Mark public pages with `auth: false`. Built-in JWT support. An unauthenticated visit to a protected page is redirected to `loginPage` before its components and layout are fetched, but the page's `<script>` is still evaluated (the `auth` option lives inside it) — never put secrets or side effects at the top level of a protected page's script.

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
  manifest: false,             // default. true | '<path>' → use vz-manifest.json (see "Manifest")
  auth: {
    enabled: true,
    loginPage: '/login',
  }
})
```

## Manifest (vz-manifest.json)

Opt-in (`manifest: true`, or a path string such as `'/vz-manifest.json'`; default off). With it off, startup requests are the same as before (`pages.json` + `components.json`). A **generator** writes `vz-manifest.json` next to `index.html`; the library only reads it. The generator is not part of this package (the npm tarball is `dist/vue-zero.js` only): the reference implementation is `npm run scan` in [vue-zero-template](https://github.com/hopegiver/vue-zero-template) (`bin/scan.js`). `pages.json` / `components.json` are still generated; the manifest is an additional artifact.

**Format v1** (full spec: [docs/architecture/manifest-format.md](docs/architecture/manifest-format.md)):

```json
{"v":1,"build":"<sha256 hex>","pages":["about","index"],"components":["AppButton"],"has404":true,"hasError":false,
 "files":{"components/AppButton.vue":"86fe3c247d","layouts/default.vue":"6d6cfd12ae","pages/about.vue":"bea73300b6"},
 "deps":{"pages/about.vue":{"layout":"default","components":["AppButton"]}}}
```

- `pages`, `components`: the same lists as `pages.json` / `components.json`.
- `files`: content hash of every `.vue` under `pages/`, `components/`, `layouts/` (first 10 hex chars of sha256 of the UTF-8 text with CRLF normalized to LF).
- `deps`: per page, its layout and the components its template uses (transitive closure). A hint only: missing or wrong `deps` make the app slower, never different.
- `build`, `has404`, `hasError` are part of the format but the library does not read them (`404.vue` / `error.vue` are fetched only when needed, with or without a manifest).

**What the library does with it** (`manifest` on):
- At startup it fetches `vz-manifest.json` with `cache: 'no-cache'` (always revalidated) instead of `pages.json` + `components.json`. If it is missing, not valid JSON, not `v: 1`, or `pages`/`components` are not arrays of strings, it reports a `E_MANIFEST_FETCH` warning and falls back to `pages.json` / `components.json`.
- **Persistent cache**: on a production host, each `.vue` listed in `files` is stored in Cache Storage (cache name `vue-zero-<library version>`) under the key `<path>?v=<hash>`, and requested from the network as that same `?v=<hash>` URL on a miss. A hit makes **no network request**; a changed file has a new hash, hence a new key. **A response is stored only if its body hashes to the manifest value** (same normalization as the generator) and it is OK and not redirected. A mismatching body (old file during a non-atomic deploy), an `index.html` returned by an SPA fallback, a redirected or non-2xx response is still used for that page view (as in 1.4.0) but is **not stored**, so the next visit fetches it again and recovers once the server is fixed. Without the Web Crypto `crypto.subtle` (which exists wherever `caches` does) nothing is stored. No server cache headers (`_headers`) are needed. Only same-origin static `.vue` sources go through this cache (no tokens, user data or API responses). Hash values that are not 1-64 word/`-` characters are ignored (that file is requested normally).
- **Dev hosts** (`localhost`, `127.0.0.1`, `[::1]`, or `?vzdev` in the URL; the same rule as the template `index.html`) never use hashes or the persistent cache, because files change while editing. The manifest's lists and `deps` are still used.
- **Cleanup**: after mount, in idle time (`requestIdleCallback`, `setTimeout` 1 s if unavailable), it deletes other versions' `vue-zero-*` caches and entries of this app's `pages`/`components`/`layouts` directories that are not in the current manifest.
- **Parallel preload**: when navigation starts, the page's `.vue`, its layout and its `deps.components` are requested at the same time. When auth is enabled and the user is not authenticated, `deps` are started only after the page's `.vue` has been fetched and parsed and its `auth` option allows the visit, so layouts and components of a protected page are not downloaded for an unauthenticated visitor. A hint request that fails (for example `deps` naming a layout file that does not exist) reports nothing and caches nothing; if the page really needs that file, the normal loading path requests and reports it as usual (`E_LAYOUT_NOT_FOUND`, `E_COMPONENT_FETCH`).

**Deploy flow**: run `scan` before every deploy so `vz-manifest.json` matches the files you ship (template: `npm run deploy` = `scan` → `wrangler deploy`; `npm run scan -- --check` only checks and reports `E_MANIFEST_STALE`). A stale manifest points at hashes of old sources, and browsers keep serving the cached old files until the manifest is regenerated. **Symptom of deploying without `scan`** (`wrangler deploy` run directly, CI or Git-connected builds that skip it): returning visitors keep seeing the old version of a changed `.vue` (its old hash is still a cache hit), and new pages/components are missing from the lists; first-time visitors get the new files. Fix: run `npm run scan` and deploy again.

**Limits of the persistent cache**:
- It needs Cache Storage (`caches`), which exists only in secure contexts (HTTPS or localhost). On plain `http://` hosts, in private modes that reject it, or when the quota is exceeded, vue-zero silently falls back to normal `fetch` (the manifest itself still works). These fallbacks are covered by tests with Chromium; other browsers are not tested.
- Several apps on one origin share the `vue-zero-<version>` cache name. Cleanup only touches the current app's directories, but an app on a different library version deletes the other version's cache, so mixed versions on one origin evict each other on every visit.
- Statically served `?v=` URLs must return the same file as the plain URL (static hosts ignore the query string). Before storing, the hash is checked against the body, so a wrong body is never stored; an already stored entry is trusted until its hash changes.
- Same-origin directories only: use root-relative `baseDir` values; an absolute-URL `baseDir` is not a supported setup for the persistent cache.
- Generator note: `deps.layout` is read from the page's top-level `layout:` option only (not from `data()` or nested objects); anything it cannot tell is left out of `deps`.

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

`stage` is one of `load | parse | eval | render | route | auth | manifest | config`. Sensitive data policy: `load`, `parse`, `manifest` and `auth` entries hold paths and HTTP status only (no tokens, query strings or user data). `render` / `route` entries (`E_RUNTIME`, `E_RENDER`, `E_ROUTE`, `E_VUE_WARN`) keep the message your code or Vue produced, so they can contain app text — but in both the buffer and the console text, JWTs, `Bearer …` values, e-mail addresses and opaque tokens (32+ word characters `[A-Za-z0-9_]` mixing letters and digits, e.g. `sk_live_…`; dashed names such as long kebab-case identifiers, UUIDs and `pkg@1.2.3` are left intact) are masked (`[jwt]`, `Bearer [token]`, `[email]`, `[token]`) and the message is cut at 300 characters. The original `Error` object is still passed to `console.error` as a second argument (same exposure as the browser's own uncaught-error output; it provides the clickable stack). On prod Vue builds the location in parentheses is Vue's own `…/error-reference/#runtime-<code>` (e.g. `5` native event handler, `3` watcher callback, `m` mounted hook, `1` render function). Runtime errors carry the real `.vue` file and line (`/pages/foo.vue:12`): scripts are evaluated with a `sourceURL` and line-aligned, so stack traces in the browser DevTools point at the `.vue` file too.

Source: **runtime** = reported by `VueZero` in the browser, **doctor** = reported by the template's `bin/doctor.js` (static check on edit), **both** = the same code from both for the same problem. `level` is a field (`error` / `warn`), never part of the code.

| Code | Source | Level | Stage | Meaning / fix |
|------|--------|-------|-------|---------------|
| `E_SCRIPT_SETUP` | both | error | eval | The `<script>` has a `setup` attribute (`<script setup>`). Use an Options API `export default {}` |
| `E_BARE_IMPORT` | both | error | eval | Bare module import (`import x from 'vue'`, `'lodash'`, ...). Scripts run as Blob URLs: Vue is global (use `Vue.xxx`, Options API); share code via globals |
| `E_RELATIVE_IMPORT` | both | error | eval | Relative-path `import` (`'../composables/x.js'`). Remove it; use globals |
| `E_SCRIPT_TS` | both | error | eval | `lang="ts"` / `lang="tsx"` with type annotations. Plain JavaScript only |
| `E_SCRIPT_EVAL` | runtime | error | eval | Other syntax / top-level error in `<script>` |
| `E_NO_EXPORT_DEFAULT` | doctor | error | — | `<script>` has no `export default { ... }`; the component would be empty |
| `E_COMPOSABLES_DIR` | doctor | error | — | A `composables/` folder exists; vue-zero shares code through globals instead |
| `E_PAGE_FETCH` / `E_LAYOUT_FETCH` / `E_COMPONENT_FETCH` | runtime | error | load | `.vue` fetch failed (HTTP status or network). 404: file missing or not in `pages.json`/`components.json` |
| `E_PAGE_LOAD`, `E_COMPONENT_LOAD`, `E_ERROR_PAGE` | runtime | error | load | Other failure while loading a page / component / `error.vue` |
| `E_LAYOUT_NOT_FOUND` | runtime | warn | load | Layout file is 404: the page renders without a layout (only 404 is cached; 5xx/network errors are retried on the next navigation) |
| `E_NOT_FOUND_PAGE` | runtime | warn | load | An unmatched URL was visited but `pages/404.vue` is missing (404): an empty page is rendered inside the layout. Reported once; the absence is cached. `404.vue` and `error.vue` are fetched only when first needed, not at startup |
| `E_RENDER` | runtime | error | render | Template render threw (undefined/null data, computed or prop) |
| `E_RUNTIME` | runtime | error | render | Hook / method / event handler / watcher threw. See `file:line` |
| `E_VUE_WARN` | runtime | warn | render | Vue development-build warning (needs `vue.global.js`, not `.prod.js`) |
| `E_STYLE_SCOPED` | both | warn | parse | `<style scoped>` is not supported; the style is applied globally |
| `E_RESERVED_TAG` | both | error | manifest | A page (and, for doctor, a component) is named like an HTML tag (`table`, `div`, ...). Rename it. The list is `HTML_RESERVED` in `src/core/RouteScanner.ts`; the runtime checks `pages.json` at startup |
| `E_MANIFEST_ENTRY` | runtime | error | manifest | `pages.json` entry ends with `.vue` |
| `E_MANIFEST_MISSING`, `E_NO_PAGES` | runtime | warn | manifest | `pages.json` missing / empty |
| `E_MANIFEST_FETCH` | runtime | warn | manifest | `manifest` option is on but `vz-manifest.json` is missing (HTTP status / network), not valid JSON or not `v: 1`. The app falls back to `pages.json` / `components.json` (works, just slower). Run `scan` and deploy the file, or remove the option |
| `E_MANIFEST_STALE` | doctor | error | — | Template `npm run doctor` / `npm run scan -- --check` only (not the runtime): `vz-manifest.json` hashes or lists differ from the real files, or the `manifest` option is on but the file is missing. Run `npm run scan` before deploying |
| `E_LOGIN_PAGE_PROTECTED` | both | error | auth | `loginPage` points at a protected page (no `auth: false`), which would redirect forever. Add `auth: false`; only navigation to the `loginPage` path itself is let through meanwhile, other paths still redirect |
| `E_LOGIN_PAGE_MISSING` | runtime | error | auth | `loginPage` matches no page and the 404 page is protected |
| `E_ROUTE` | runtime | error | route | Unexpected exception during navigation |
| `E_OPTION_INVALID`, `E_AUTH_CONFIG` | runtime | error / warn | config | Invalid `createApp` option |

During development, load the Vue **development** build (`vue.global.js`) instead of `vue.global.prod.js`: with the prod build Vue hides template warnings (unknown components, undefined properties). On `localhost`, vue-zero prints a one-time `console.info` when it detects the prod build.

## Rules for AI

1. **Register files** — Add pages to `pages/pages.json`, components to `components/components.json` (without `.vue` extension). Or run `npm run scan`.
2. **Options API only** — No `<script setup>`, no Composition API, no TypeScript
3. **No `<style scoped>`** — Use Bootstrap classes + `base.css` tokens. Use class names for isolation when needed.
4. **404 page** — `pages/404.vue` is auto-detected. Do NOT add it to `pages.json`
5. **Error page** — `pages/error.vue` is auto-detected. Do NOT add it to `pages.json`

## License

[MIT](LICENSE)
