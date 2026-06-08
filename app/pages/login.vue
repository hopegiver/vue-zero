<template>
  <div class="page-login">
    <div class="login-card">
      <h1>로그인</h1>
      <form @submit.prevent="login">
        <input v-model="email" type="email" placeholder="이메일" />
        <input v-model="password" type="password" placeholder="비밀번호" />
        <AppButton>로그인</AppButton>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
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

<style>
.page-login {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; background: #f5f5f5;
}
.login-card {
  background: #fff; padding: 2rem; border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 320px;
}
.login-card h1 { margin: 0 0 1.5rem; color: #35495e; text-align: center; }
.login-card input {
  display: block; width: 100%; padding: 0.5rem; margin-bottom: 0.75rem;
  border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;
}
.login-card .app-button { width: 100%; }
.login-card .error { color: #e74c3c; margin-top: 0.75rem; text-align: center; }
</style>
