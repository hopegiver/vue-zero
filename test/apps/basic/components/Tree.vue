<template>
  <ul class="tree"><li class="tree-node">{{ node.name }}<Tree v-for="c in (node.children || [])" :key="c.name" :node="c" /></li></ul>
</template>
<script>
export default { props: ['node'] }
</script>
