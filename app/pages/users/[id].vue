<template>
  <div class="page-user-detail">
    <p v-if="loading">불러오는 중...</p>
    <template v-else-if="user">
      <h1>{{ user.name }}</h1>
      <p class="email">{{ user.email }}</p>
      <div class="user-nav">
        <router-link :to="'/users/' + user.id + '/posts'">게시글 보기 →</router-link>
      </div>
      <div class="other-users">
        <p>다른 유저:</p>
        <router-link v-for="id in otherUserIds" :key="id" :to="'/users/' + id">유저 #{{ id }}</router-link>
      </div>
    </template>
    <p v-else class="error">유저를 찾을 수 없습니다.</p>
    <router-link to="/users">← Users</router-link>
  </div>
</template>

<script>
export default {
  title: '유저 상세',
  data() {
    return {
      user: null,
      loading: true,
    }
  },
  computed: {
    otherUserIds() {
      const current = Number(this.$route.params.id)
      return [1, 2, 3, 4, 5].filter(id => id !== current)
    }
  },
  async mounted() {
    await this.loadUser()
  },
  watch: {
    '$route.params.id'() {
      this.loadUser()
    }
  },
  methods: {
    async loadUser() {
      this.loading = true
      const id = this.$route.params.id
      try {
        const res = await fetch(`/api/users/${id}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        this.user = data.user
      } catch {
        this.user = null
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style>
.page-user-detail { padding: 2rem; }
.page-user-detail h1 { color: #42b883; }
.page-user-detail .email { color: #888; }
.page-user-detail .error { color: #e74c3c; }
.page-user-detail a { color: #42b883; }
.user-nav { margin: 1rem 0; }
.other-users { margin: 1.5rem 0; padding-top: 1rem; border-top: 1px solid #eee; }
.other-users p { color: #888; margin-bottom: 0.5rem; }
.other-users a { margin-right: 0.75rem; }
</style>
