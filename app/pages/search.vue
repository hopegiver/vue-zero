<template>
  <div class="container py-4">
    <h1 class="mb-3">검색</h1>
    <div class="card p-4 mb-3">
      <input v-model="keyword" class="form-control mb-2" placeholder="검색어 입력..." @input="onSearch" />
      <p class="text-faint small mb-0">쿼리: q={{ $route.query.q || '(없음)' }}</p>
    </div>
    <div v-if="results.length" class="card p-4 mb-3">
      <ul class="list-unstyled mb-0">
        <li v-for="item in results" :key="item" class="py-1 border-bottom">{{ item }}</li>
      </ul>
    </div>
    <p v-else-if="keyword" class="text-muted small">검색 결과가 없습니다.</p>
    <router-link to="/" class="small">← Home</router-link>
  </div>
</template>

<script>
export default {
  title: '검색',
  data() {
    return {
      keyword: '',
      results: [],
      allItems: ['Vue.js', 'vue-zero', 'Vue Router', 'Pinia', 'Nuxt', 'Vite', 'Cloudflare Workers', 'Hono'],
    }
  },
  mounted() {
    const q = this.$route.query.q
    if (q) {
      this.keyword = q
      this.filter()
    }
  },
  methods: {
    onSearch() {
      this.filter()
      this.$router.replace({ query: this.keyword ? { q: this.keyword } : {} })
    },
    filter() {
      const k = this.keyword.toLowerCase()
      this.results = k ? this.allItems.filter(item => item.toLowerCase().includes(k)) : []
    }
  }
}
</script>
