<template>
  <div><UserCard /><component :is="dyn" /><Missing /></div>
</template>
<script>
export default { layout: false, auth: false }
</script>
