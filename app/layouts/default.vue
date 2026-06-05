<template>
  <div class="layout-default">
    <header class="site-header">
      <strong>vue-zero</strong>
      <nav>
        <router-link to="/">Home</router-link>
        <router-link to="/about">About</router-link>
        <router-link to="/users">Users</router-link>
      </nav>
    </header>
    <main class="site-main">
      <slot />
    </main>
    <footer class="site-footer">vue-zero &copy; 2024</footer>
  </div>
</template>

<script>
export default {}
</script>

<style>
.layout-default { display: flex; flex-direction: column; min-height: 100vh; }
.site-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 2rem; background: #35495e; color: #fff; }
.site-header nav a { color: #fff; margin-left: 1rem; text-decoration: none; }
.site-header nav a:hover { text-decoration: underline; }
.site-main { flex: 1; }
.site-footer { text-align: center; padding: 0.75rem; background: #f5f5f5; color: #888; font-size: 0.85rem; }
</style>
