<template>
  <div class="page-home">
    <h1>{{ title }}</h1>
    <p>vue-zero 예제 앱입니다.</p>
    <nav class="page-nav">
      <h2>페이지 목록</h2>
      <ul>
        <li><router-link to="/about">About</router-link> — 정적 페이지</li>
        <li><router-link to="/contact">Contact</router-link> — 폼 + title 옵션</li>
        <li><router-link to="/counter">Counter</router-link> — computed + watch</li>
        <li><router-link to="/search">Search</router-link> — 쿼리스트링 ($route.query)</li>
        <li><router-link to="/search?q=vue">Search?q=vue</router-link> — 쿼리스트링 프리셋</li>
        <li><router-link to="/settings">Settings</router-link> — select, checkbox</li>
        <li><router-link to="/minimal">Minimal</router-link> — script 없는 순수 템플릿</li>
        <li><router-link to="/todo">Todo</router-link> — CRUD + 필터 + 인라인 편집</li>
        <li><router-link to="/dashboard">Dashboard</router-link> — 그리드 레이아웃 + requiresAuth</li>
        <li><router-link to="/datatable">DataTable</router-link> — 정렬 + 검색 + 페이지네이션</li>
        <li><router-link to="/tabs?tab=profile">Tabs</router-link> — 탭 UI + 쿼리스트링 동기화</li>
        <li><router-link to="/gallery">Gallery</router-link> — 그리드/리스트 뷰 전환 + 모달</li>
        <li><router-link to="/timer">Timer</router-link> — setInterval + beforeUnmount 정리</li>
        <li><router-link to="/users">Users</router-link> — API 데이터 (mounted)</li>
        <li><router-link to="/users/1">User #1</router-link> — 동적 라우트 [id]</li>
        <li><router-link to="/users/1/posts">User #1 Posts</router-link> — 중첩 동적 [id]/posts</li>
        <li><router-link to="/admin">Admin</router-link> — layout: 'admin' (레이아웃 전환)</li>
        <li><router-link to="/admin/members">Admin 회원관리</router-link> — admin 레이아웃 내 이동</li>
        <li><router-link to="/login">Login</router-link> — layout: false</li>
        <li><router-link to="/nonexistent">404 테스트</router-link> — 존재하지 않는 경로</li>
      </ul>
    </nav>
    <AppButton @click="greet">인사하기</AppButton>
    <p v-if="message">{{ message }}</p>
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

<style>
.page-home { padding: 2rem; }
.page-home h1 { color: #42b883; }
.page-nav { margin: 1.5rem 0; }
.page-nav h2 { color: #35495e; font-size: 1.1rem; margin-bottom: 0.5rem; }
.page-nav ul { padding: 0; }
.page-nav li { list-style: none; margin: 0.4rem 0; }
.page-nav a { color: #42b883; text-decoration: none; }
.page-nav a:hover { text-decoration: underline; }
</style>
