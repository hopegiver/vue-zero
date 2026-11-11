<template>
  <span data-testid="boom">boom</span>
</template>

<script>
export default {
  mounted() {
    throw new Error('boom-component')
  },
}
</script>
