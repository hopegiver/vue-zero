<template>
  <div class="container py-4">
    <h1 class="mb-3">{{ userName }}의 게시글</h1>
    <p v-if="loading" class="text-muted">불러오는 중...</p>
    <div v-else-if="posts.length" class="card overflow-hidden mb-3">
      <ul class="list-unstyled mb-0">
        <li v-for="post in posts" :key="post.id" class="px-3 py-2 border-bottom small">{{ post.title }}</li>
      </ul>
    </div>
    <p v-if="!loading && posts.length === 0" class="text-muted small">게시글이 없습니다.</p>
    <div class="d-flex gap-3">
      <router-link :to="'/users/' + $route.params.id" class="small">← 유저 정보</router-link>
      <router-link to="/users" class="small">← 유저 목록</router-link>
    </div>
  </div>
</template>

<script>
export default {
  title: '유저 게시글',
  data() {
    return {
      userName: '',
      posts: [],
      loading: true,
    }
  },
  async mounted() {
    const id = this.$route.params.id
    this.userName = '유저 ' + id
    try {
      const res = await fetch(`/api/users/${id}/posts`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      this.posts = data.posts
    } catch {
      this.posts = []
    } finally {
      this.loading = false
    }
  }
}
</script>
