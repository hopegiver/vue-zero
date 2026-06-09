<template>
  <div class="d-flex flex-column min-vh-100">
    <nav class="navbar navbar-expand navbar-dark bg-ink px-4 py-2">
      <router-link to="/" class="navbar-brand fw-bold">vue-zero</router-link>
      <div class="navbar-nav ms-auto gap-3">
        <router-link to="/" class="nav-link">Home</router-link>
        <router-link to="/about" class="nav-link">About</router-link>
        <router-link to="/users" class="nav-link">Users</router-link>
      </div>
    </nav>
    <main class="flex-grow-1">
      <slot />
    </main>
    <footer class="text-center py-3 bg-canvas-soft text-muted small border-top border-hairline">vue-zero &copy; 2024</footer>
  </div>
</template>

<script>
export default {}
</script>
