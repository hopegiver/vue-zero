<template>
  <div class="container py-4">
    <h1 class="mb-1">{{ title }}</h1>
    <p class="text-muted mb-4">vue-zero 예제 앱입니다.</p>
    <div class="card p-4 mb-4">
      <h2 class="h6 mb-3">페이지 목록</h2>
      <ul class="list-unstyled mb-0">
        <li class="py-1 border-bottom"><router-link to="/about">About</router-link> <span class="text-faint small">— 정적 페이지</span></li>
        <li class="py-1 border-bottom"><router-link to="/contact">Contact</router-link> <span class="text-faint small">— 폼 + title 옵션</span></li>
        <li class="py-1 border-bottom"><router-link to="/counter">Counter</router-link> <span class="text-faint small">— computed + watch</span></li>
        <li class="py-1 border-bottom"><router-link to="/search">Search</router-link> <span class="text-faint small">— 쿼리스트링 ($route.query)</span></li>
        <li class="py-1 border-bottom"><router-link to="/search?q=vue">Search?q=vue</router-link> <span class="text-faint small">— 쿼리스트링 프리셋</span></li>
        <li class="py-1 border-bottom"><router-link to="/settings">Settings</router-link> <span class="text-faint small">— select, checkbox</span></li>
        <li class="py-1 border-bottom"><router-link to="/minimal">Minimal</router-link> <span class="text-faint small">— script 없는 순수 템플릿</span></li>
        <li class="py-1 border-bottom"><router-link to="/todo">Todo</router-link> <span class="text-faint small">— CRUD + 필터 + 인라인 편집</span></li>
        <li class="py-1 border-bottom"><router-link to="/dashboard">Dashboard</router-link> <span class="text-faint small">— 그리드 레이아웃 + requiresAuth</span></li>
        <li class="py-1 border-bottom"><router-link to="/datatable">DataTable</router-link> <span class="text-faint small">— 정렬 + 검색 + 페이지네이션</span></li>
        <li class="py-1 border-bottom"><router-link to="/tabs?tab=profile">Tabs</router-link> <span class="text-faint small">— 탭 UI + 쿼리스트링 동기화</span></li>
        <li class="py-1 border-bottom"><router-link to="/gallery">Gallery</router-link> <span class="text-faint small">— 그리드/리스트 뷰 전환 + 모달</span></li>
        <li class="py-1 border-bottom"><router-link to="/timer">Timer</router-link> <span class="text-faint small">— setInterval + beforeUnmount 정리</span></li>
        <li class="py-1 border-bottom"><router-link to="/users">Users</router-link> <span class="text-faint small">— API 데이터 (mounted)</span></li>
        <li class="py-1 border-bottom"><router-link to="/users/1">User #1</router-link> <span class="text-faint small">— 동적 라우트 [id]</span></li>
        <li class="py-1 border-bottom"><router-link to="/users/1/posts">User #1 Posts</router-link> <span class="text-faint small">— 중첩 동적 [id]/posts</span></li>
        <li class="py-1 border-bottom"><router-link to="/admin">Admin</router-link> <span class="text-faint small">— layout: 'admin' (레이아웃 전환)</span></li>
        <li class="py-1 border-bottom"><router-link to="/admin/members">Admin 회원관리</router-link> <span class="text-faint small">— admin 레이아웃 내 이동</span></li>
        <li class="py-1 border-bottom"><router-link to="/login">Login</router-link> <span class="text-faint small">— layout: false</span></li>
        <li class="py-1"><router-link to="/nonexistent">404 테스트</router-link> <span class="text-faint small">— 존재하지 않는 경로</span></li>
      </ul>
    </div>
    <AppButton @click="greet">인사하기</AppButton>
    <p v-if="message" class="mt-2 small fw-medium">{{ message }}</p>
  </div>
</template>

<script>
export default {
  title: 'vue-zero Home',
  data() {
    return {
      title: 'vue-zero Home',
      message: '',
    }
  },
  methods: {
    greet() {
      this.message = '안녕하세요! vue-zero 입니다.'
    }
  }
}
</script>
