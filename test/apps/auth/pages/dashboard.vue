<template>
  <div><h1 data-testid="page">Dashboard (protected)</h1>
    <span data-testid="api-status">{{ status }}</span>
    <span data-testid="api-name">{{ name }}</span>
  </div>
</template>
<script>
export default {
  data() { return { status: 'pending', name: '' } },
  // 보호된 API 가 실제로 200 을 주는지(= 화면 도달이 아니라 서버 검증)까지 확인하기 위한 호출
  async mounted() {
    const o = window.__VZ_OPTIONS__ || {}
    const key = (o.auth && o.auth.tokenKey) || 'token'
    const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem(key) } })
    this.status = res.status
    if (res.ok) this.name = (await res.json()).user.name
  },
}
</script>
