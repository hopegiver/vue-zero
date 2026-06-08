<template>
  <div class="page-user-posts">
    <h1>{{ userName }}의 게시글</h1>
    <p v-if="loading">불러오는 중...</p>
    <ul v-else>
      <li v-for="post in posts" :key="post.id">{{ post.title }}</li>
    </ul>
    <p v-if="!loading && posts.length === 0">게시글이 없습니다.</p>
    <router-link :to="'/users/' + $route.params.id">← 유저 정보</router-link>
    |
    <router-link to="/users">← 유저 목록</router-link>
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

<style>
.page-user-posts { padding: 2rem; }
.page-user-posts h1 { color: #35495e; }
.page-user-posts ul { padding: 0; }
.page-user-posts li { list-style: none; margin: 0.3rem 0; }
.page-user-posts a { color: #42b883; }
</style>
