<template>
  <div class="page-404">
    <h1>404</h1>
    <p>페이지를 찾을 수 없습니다</p>
    <router-link to="/">홈으로 돌아가기</router-link>
  </div>
</template>

<style>
.page-404 {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}
.page-404 h1 {
  font-size: 4rem;
  margin: 0;
  color: #374151;
}
.page-404 p {
  font-size: 1.2rem;
  color: #6b7280;
  margin: 0.5rem 0 1.5rem;
}
.page-404 a {
  color: #3b82f6;
  text-decoration: none;
}
.page-404 a:hover {
  text-decoration: underline;
}
</style>
