<template>
  <div data-testid="layout-alt" class="layout-alt">
    <header class="alt-header">ALT HEADER <shared-badge /></header>
    <main><slot /></main>
  </div>
</template>

<script>
export default {}
</script>

<style>
.alt-header { border-bottom: 1px solid rgb(1, 2, 3); }
</style>
