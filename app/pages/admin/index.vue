<template>
  <div>
    <h1 class="h4 mt-0 mb-3">관리자 대시보드</h1>
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3" v-for="stat in stats" :key="stat.label">
        <div class="card p-3 text-center">
          <div class="fs-3 fw-bold">{{ stat.value }}</div>
          <div class="text-faint small">{{ stat.label }}</div>
        </div>
      </div>
    </div>
    <div class="card p-4">
      <h2 class="h6 mb-3">빠른 작업</h2>
      <button class="btn btn-outline-secondary btn-sm" @click="showNotice = !showNotice">공지 {{ showNotice ? '닫기' : '작성' }}</button>
      <div v-if="showNotice" class="mt-3 max-w-form">
        <label class="form-label small fw-bold">공지 제목</label>
        <input v-model="noticeTitle" class="form-control mb-2" placeholder="공지 제목" />
        <label class="form-label small fw-bold">공지 내용</label>
        <textarea v-model="noticeBody" class="form-control mb-3" placeholder="공지 내용" rows="3"></textarea>
        <AppButton @click="postNotice">등록</AppButton>
        <p v-if="noticePosted" class="mt-2 mb-0 small fw-bold text-success-custom">공지가 등록되었습니다.</p>
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
