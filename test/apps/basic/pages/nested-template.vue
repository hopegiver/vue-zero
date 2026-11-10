<template>
  <div>
    <h1 data-testid="page">Nested template</h1>
    <template v-if="show"><p data-testid="nt-a">A</p></template>
    <template v-for="i in 3" :key="i"><span class="nt-item">{{ i }}</span></template>
    <template v-if="show"><template v-if="show"><p data-testid="nt-deep">deep</p></template></template>
    <p data-testid="after">after-nested</p>
  </div>
</template>
<script>
export default { data() { return { show: true } } }
</script>
