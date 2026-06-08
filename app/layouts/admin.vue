<template>
  <div class="layout-admin">
    <aside class="admin-sidebar">
      <div class="admin-logo">관리자</div>
      <nav>
        <router-link to="/admin">대시보드</router-link>
        <router-link to="/admin/members">회원관리</router-link>
        <router-link to="/">사이트로 돌아가기</router-link>
      </nav>
    </aside>
    <div class="admin-body">
      <header class="admin-header">
        <span>Admin Panel</span>
      </header>
      <main class="admin-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script>
export default {}
</script>

<style>
.layout-admin { display: flex; min-height: 100vh; }
.admin-sidebar { width: 200px; background: #1a1a2e; color: #fff; padding: 1rem; flex-shrink: 0; }
.admin-logo { font-size: 1.2rem; font-weight: bold; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid #333; }
.admin-sidebar nav { display: flex; flex-direction: column; gap: 0.5rem; }
.admin-sidebar nav a { color: #aaa; text-decoration: none; padding: 0.4rem 0.5rem; border-radius: 4px; }
.admin-sidebar nav a:hover, .admin-sidebar nav a.router-link-active { color: #fff; background: #16213e; }
.admin-body { flex: 1; display: flex; flex-direction: column; }
.admin-header { padding: 0.75rem 1.5rem; background: #16213e; color: #fff; font-weight: bold; }
.admin-main { flex: 1; padding: 1.5rem; background: #f0f2f5; }
</style>
