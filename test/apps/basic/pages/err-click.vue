<template>
  <button data-testid="boom-btn" @click="boom">boom</button>
</template>

<script>
export default {
  methods: { boom() { throw new Error('boom-click') } },
}
</script>
