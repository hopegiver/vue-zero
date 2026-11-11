<template><div><AppButton /></div></template>
<script>
export default {
  props: { layout: { type: String, default: 'compact' } },
  data() { return { opts: { layout: 'wide' } } },
}
</script>
