<template><h1 data-testid="page">err-secret</h1></template>
<script>
export default {
  mounted() {
    throw new Error('bad token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2ln end')
  },
}
</script>
