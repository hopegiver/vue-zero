<template>
  <div class="container py-4">
    <p v-if="loading" class="text-muted">불러오는 중...</p>
    <template v-else-if="user">
      <h1 class="mb-1">{{ user.name }}</h1>
      <p class="text-muted small mb-3">{{ user.email }}</p>
      <div class="card p-4 mb-3">
        <router-link :to="'/users/' + user.id + '/posts'" class="small">게시글 보기 →</router-link>
      </div>
      <div class="card p-4 mb-3">
        <p class="text-faint small mb-2">다른 유저</p>
        <div class="d-flex gap-2 flex-wrap">
          <router-link v-for="id in otherUserIds" :key="id" :to="'/users/' + id" class="btn btn-outline-secondary btn-sm">유저 #{{ id }}</router-link>
        </div>
      </div>
    </template>
    <p v-else class="text-danger small">유저를 찾을 수 없습니다.</p>
    <router-link to="/users" class="small">← Users</router-link>
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
