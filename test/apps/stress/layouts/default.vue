<template><div data-testid="layout"><nav><router-link v-for="l in links" :key="l" :to="l" :data-link="l">{{ l }}</router-link></nav><slot /></div></template>
<script>
export default { data() { return { links: ['/', '/small', '/chain', '/many', '/all'] } } }
</script>
