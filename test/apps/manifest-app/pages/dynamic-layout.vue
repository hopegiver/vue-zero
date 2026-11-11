<template><h1 data-testid="page">Dynamic layout</h1></template>
<script>
// layout 이 리터럴이 아니면 scan 이 deps 를 생략한다 (힌트 없음 → 기존 경로)
export default { layout: window.__LAYOUT__ || 'default' }
</script>
