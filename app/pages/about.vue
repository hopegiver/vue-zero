<template>
  <div class="container py-4">
    <h1 class="mb-3">About</h1>
    <div class="card p-4 mb-4">
      <p class="mb-3">vue-zero — 제로빌드 Vue 3 라우터</p>
      <ul class="mb-0">
        <li>빌드 없음, CDN 한 줄</li>
        <li>Nuxt 동일 폴더 구조</li>
        <li>Options API 전용</li>
      </ul>
    </div>
    <router-link to="/" class="small">← Home</router-link>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>
