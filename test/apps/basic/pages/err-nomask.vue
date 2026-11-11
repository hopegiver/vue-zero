<template><h1 data-testid="page">err-nomask</h1></template>
<script>
export default {
  mounted() {
    throw new Error('dep lodash@4.17.21 missing in user-notification-preferences-settings-panel at blob:http://localhost/3f2a9c1e-7b4d-4e8a-9c55-0a1b2c3d4e5f')
  },
}
</script>
