<template>
  <div><h1 data-testid="page">comp-dynamic</h1>
    <button class="show" @click="show = true">show</button>
    <component v-if="show" :is="'DynamicWidget'" />
  </div>
</template>
<script>
export default { data() { return { show: false } } }
</script>
