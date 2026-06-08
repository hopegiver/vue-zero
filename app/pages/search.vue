<template>
  <div class="page-search">
    <h1>검색</h1>
    <input v-model="keyword" placeholder="검색어 입력..." @input="onSearch" />
    <p class="query-info">쿼리: q={{ $route.query.q || '(없음)' }}</p>
    <ul v-if="results.length">
      <li v-for="item in results" :key="item">{{ item }}</li>
    </ul>
    <p v-else-if="keyword">검색 결과가 없습니다.</p>
    <router-link to="/">← Home</router-link>
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

<style>
.page-search { padding: 2rem; }
.page-search h1 { color: #35495e; }
.page-search input {
  padding: 0.5rem; width: 100%; max-width: 400px;
  border: 1px solid #ddd; border-radius: 4px; margin-bottom: 1rem; box-sizing: border-box;
}
.page-search .query-info { color: #888; font-size: 0.85rem; }
.page-search ul { padding: 0; }
.page-search li { list-style: none; margin: 0.3rem 0; }
.page-search a { color: #42b883; }
</style>
