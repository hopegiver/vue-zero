<template>
  <div class="page-users">
    <h1>Users</h1>
    <p v-if="loading">불러오는 중...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <ul v-else>
      <li v-for="user in users" :key="user.id">
        <router-link :to="'/users/' + user.id">{{ user.name }}</router-link>
        <span class="email">{{ user.email }}</span>
      </li>
    </ul>
    <router-link to="/">← Home</router-link>
  </div>
</template>

<script>
export default {
  data() {
    return {
      users: [],
      loading: true,
      error: null,
    }
  },
  async mounted() {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      this.users = data.users
    } catch (e) {
      this.error = '유저 목록을 불러오지 못했습니다.'
    } finally {
      this.loading = false
    }
  }
}
</script>

<style>
.page-users { padding: 2rem; }
.page-users h1 { color: #35495e; }
.page-users ul { padding: 0; }
.page-users li { margin: 0.4rem 0; list-style: none; }
.page-users a { color: #42b883; }
.page-users .email { margin-left: 0.75rem; color: #888; font-size: 0.9rem; }
.page-users .error { color: #e74c3c; }
</style>
