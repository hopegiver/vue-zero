<template>
  <div><h1 data-testid="page">User</h1>
    <span data-testid="param">{{ $route.params.id }}</span>
    <span data-testid="query">{{ $route.query.tab }}</span>
    <span data-testid="hash">{{ $route.hash }}</span>
  </div>
</template>
<script>
export default {}
</script>
