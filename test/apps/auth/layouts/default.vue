<template>
  <div data-testid="layout">
    <nav><router-link to="/" data-link="/">home</router-link> <router-link to="/public" data-link="/public">public</router-link></nav>
    <slot />
  </div>
</template>
<script>
export default {}
</script>
