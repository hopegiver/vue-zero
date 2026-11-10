<template>
  <div data-testid="layout-default" class="layout">
    <nav>
      <router-link v-for="l in links" :key="l" :to="l" :data-link="l">{{ l }}</router-link>
    </nav>
    <main><slot /></main>
  </div>
</template>

<script>
export default {
  data() {
    return { links: ['/', '/about', '/users', '/slow-a', '/slow-b', '/style-a', '/style-b', '/layout-alt', '/layout-none', '/does-not-exist'] }
  },
}
</script>
