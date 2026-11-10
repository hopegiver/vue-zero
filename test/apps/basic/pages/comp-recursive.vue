<template><div><h1 data-testid="page">comp-recursive</h1><Tree :node="tree" /></div></template>
<script>
export default {
  data() { return { tree: { name: 'root', children: [{ name: 'a', children: [{ name: 'a1' }] }, { name: 'b' }] } } },
}
</script>
