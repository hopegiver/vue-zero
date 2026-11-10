<template>
  <div><h1 data-testid="page">Search</h1>
    <span data-testid="q">{{ $route.query.q }}</span>
    <span data-testid="hash">{{ $route.hash }}</span>
    <button class="go" @click="$router.push({ path: '/search', query: { q: 'next' }, hash: '#frag' })">go</button>
  </div>
</template>
<script>
export default {}
</script>
