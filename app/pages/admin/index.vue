<template>
  <div class="page-admin-dashboard">
    <h1>관리자 대시보드</h1>
    <div class="admin-stats">
      <div class="admin-stat" v-for="stat in stats" :key="stat.label">
        <div class="stat-num">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </div>
    </div>
    <div class="admin-quick">
      <h2>빠른 작업</h2>
      <AppButton @click="showNotice = !showNotice">공지 {{ showNotice ? '닫기' : '작성' }}</AppButton>
      <div v-if="showNotice" class="notice-form">
        <input v-model="noticeTitle" placeholder="공지 제목" />
        <textarea v-model="noticeBody" placeholder="공지 내용" rows="3"></textarea>
        <AppButton @click="postNotice">등록</AppButton>
        <p v-if="noticePosted" class="success">공지가 등록되었습니다.</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'admin',
  title: '관리자 대시보드',
  data() {
    return {
      stats: [
        { label: '총 회원', value: 1234 },
        { label: '오늘 가입', value: 12 },
        { label: '활성 세션', value: 89 },
        { label: '신고 접수', value: 3 },
      ],
      showNotice: false,
      noticeTitle: '',
      noticeBody: '',
      noticePosted: false,
    }
  },
  methods: {
    postNotice() {
      if (!this.noticeTitle.trim()) return
      this.noticePosted = true
      this.noticeTitle = ''
      this.noticeBody = ''
      setTimeout(() => { this.noticePosted = false }, 2000)
    }
  }
}
</script>

<style>
.page-admin-dashboard h1 { color: #1a1a2e; margin-top: 0; }
.admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.admin-stat { background: #fff; padding: 1rem; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.stat-num { font-size: 1.8rem; font-weight: bold; color: #1a1a2e; }
.stat-label { color: #888; font-size: 0.85rem; margin-top: 0.25rem; }
.admin-quick h2 { color: #1a1a2e; font-size: 1.1rem; }
.notice-form { margin-top: 1rem; max-width: 400px; }
.notice-form input, .notice-form textarea {
  display: block; width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;
  border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;
}
.notice-form .success { color: #42b883; font-weight: bold; }
</style>
