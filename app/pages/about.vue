<template>
  <div class="page-about">
    <h1>About</h1>
    <p>vue-zero — 제로빌드 Vue 3 라우터</p>
    <ul>
      <li>빌드 없음, CDN 한 줄</li>
      <li>Nuxt 동일 폴더 구조</li>
      <li>Options API 전용</li>
    </ul>
    <router-link to="/">← Home</router-link>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>

<style>
.page-about { padding: 2rem; }
.page-about h1 { color: #35495e; }
.page-about a { color: #42b883; }
</style>
