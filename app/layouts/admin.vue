<template>
  <div class="d-flex min-vh-100">
    <aside class="sidebar d-flex flex-column p-3 text-white flex-shrink-0 bg-ink">
      <div class="fs-5 fw-bold mb-4 pb-3 border-bottom border-secondary">관리자</div>
      <nav class="d-flex flex-column gap-1">
        <router-link to="/admin" class="text-decoration-none text-white-50 px-2 py-1 rounded-1 admin-nav-link">대시보드</router-link>
        <router-link to="/admin/members" class="text-decoration-none text-white-50 px-2 py-1 rounded-1 admin-nav-link">회원관리</router-link>
        <router-link to="/" class="text-decoration-none text-white-50 px-2 py-1 rounded-1 admin-nav-link mt-4 small">← 사이트로 돌아가기</router-link>
      </nav>
    </aside>
    <div class="d-flex flex-column flex-grow-1">
      <header class="px-4 py-2 fw-bold border-bottom bg-canvas">Admin Panel</header>
      <main class="flex-grow-1 p-4 bg-canvas-soft">
        <slot />
      </main>
    </div>
  </div>
</template>

<script>
export default {}
</script>

<style>
.admin-nav-link:hover,
.admin-nav-link.router-link-active { color: #fff !important; background: rgba(255,255,255,0.1); }
</style>
