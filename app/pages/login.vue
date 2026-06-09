<template>
  <div class="d-flex align-items-center justify-content-center min-vh-100 bg-canvas-soft">
    <div class="card p-4 login-card">
      <h1 class="h4 text-center mb-4">로그인</h1>
      <form @submit.prevent="login">
        <label class="form-label small fw-bold">이메일</label>
        <input v-model="email" type="email" class="form-control mb-3" placeholder="이메일" />
        <label class="form-label small fw-bold">비밀번호</label>
        <input v-model="password" type="password" class="form-control mb-3" placeholder="비밀번호" />
        <button class="btn btn-primary w-100">로그인</button>
      </form>
      <p v-if="error" class="text-danger text-center mt-3 mb-0 small">{{ error }}</p>
    </div>
  </div>
</template>

<script>
export default {
  layout: false,
  title: '로그인',
  data() {
    return {
      email: '',
      password: '',
      error: null,
    }
  },
  methods: {
    async login() {
      this.error = null
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.email, password: this.password }),
        })
        if (!res.ok) throw new Error('로그인 실패')
        const data = await res.json()
        localStorage.setItem('token', data.token)
        this.$router.push('/')
      } catch (e) {
        this.error = '이메일 또는 비밀번호가 올바르지 않습니다.'
      }
    }
  }
}
</script>
