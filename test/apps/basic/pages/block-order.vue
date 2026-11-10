<script>
export default { data() { return { msg: 'order-ok' } } }
</script>

<style>
.block-order { color: rgb(10, 20, 30); }
</style>

<template>
  <h1 data-testid="page" class="block-order">{{ msg }}</h1>
</template>
