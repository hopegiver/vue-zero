<template>
  <h1 data-testid="page">err-runtime</h1>
</template>

<script>
export default {
  mounted() {
    throw new Error('boom-page')
  },
}
</script>
