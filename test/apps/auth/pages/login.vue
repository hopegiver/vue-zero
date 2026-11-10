<template>
  <form data-testid="login-form" class="login-form" @submit.prevent="submit">
    <h1 data-testid="page">login</h1>
    <input name="email" type="email" v-model="email">
    <input name="password" type="password" v-model="password">
    <button type="submit">go</button>
    <p data-testid="login-error">{{ error }}</p>
  </form>
</template>
<script>
export default {
  auth: false,
  data() { return { email: '', password: '', error: '' } },
  methods: {
    async submit() {
      const o = window.__VZ_OPTIONS__ || {}
      const key = (o.auth && o.auth.tokenKey) || 'token'
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: this.email, password: this.password }) })
      if (!res.ok) { this.error = 'login failed ' + res.status; return }
      localStorage.setItem(key, (await res.json()).token)
      this.$router.push('/dashboard')
    },
  },
}
</script>
