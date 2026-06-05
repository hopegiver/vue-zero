<template>
  <div class="page-user-detail">
    <p v-if="loading">불러오는 중...</p>
    <template v-else-if="user">
      <h1>{{ user.name }}</h1>
      <p class="email">{{ user.email }}</p>
    </template>
    <p v-else class="error">유저를 찾을 수 없습니다.</p>
    <router-link to="/users">← Users</router-link>
  </div>
</template>

<script>
export default {
  data() {
    return {
      user: null,
      loading: true,
    }
  },
  async mounted() {
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
</script>

<style>
.page-user-detail { padding: 2rem; }
.page-user-detail h1 { color: #42b883; }
.page-user-detail .email { color: #888; }
.page-user-detail .error { color: #e74c3c; }
.page-user-detail a { color: #42b883; }
</style>
