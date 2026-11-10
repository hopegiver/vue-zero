<template>
  <div class="ping">ping{{ depth }}<Pong v-if="depth < 2" :depth="depth + 1" /></div>
</template>
<script>
export default { props: { depth: { type: Number, default: 0 } } }
</script>
