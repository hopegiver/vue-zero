<template>
  <h1 data-testid="page">err-watch {{ n }}</h1>
</template>

<script>
export default {
  data() { return { n: 0 } },
  watch: { n() { throw new Error('boom-watch') } },
  mounted() { this.n = 1 },
}
</script>
