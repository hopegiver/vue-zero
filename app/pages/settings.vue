<template>
  <div class="container py-4">
    <h1 class="mb-3">설정</h1>
    <div class="card p-4 mb-3">
      <div class="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom">
        <label class="fw-bold small min-w-label">테마</label>
        <select v-model="theme" class="form-select w-auto">
          <option value="light">라이트</option>
          <option value="dark">다크</option>
        </select>
      </div>
      <div class="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom">
        <label class="fw-bold small min-w-label">알림</label>
        <input type="checkbox" class="form-check-input" v-model="notifications" />
        <span class="small text-muted">{{ notifications ? '켜짐' : '꺼짐' }}</span>
      </div>
      <div class="d-flex align-items-center gap-3 mb-3">
        <label class="fw-bold small min-w-label">언어</label>
        <select v-model="lang" class="form-select w-auto">
          <option value="ko">한국어</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
        </select>
      </div>
      <AppButton @click="save">저장</AppButton>
      <p v-if="saved" class="mt-2 mb-0 small fw-bold text-success-custom">설정이 저장되었습니다.</p>
    </div>
    <router-link to="/" class="small">← Home</router-link>
  </div>
</template>

<script>
export default {
  title: '설정',
  data() {
    return {
      theme: 'light',
      notifications: true,
      lang: 'ko',
      saved: false,
    }
  },
  methods: {
    save() {
      this.saved = true
      setTimeout(() => { this.saved = false }, 2000)
    }
  }
}
</script>
