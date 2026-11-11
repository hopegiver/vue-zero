<template>
  <div data-testid="layout-boom">
    <slot />
  </div>
</template>

<script>
export default {
  mounted() {
    throw new Error('boom-layout')
  },
}
</script>
