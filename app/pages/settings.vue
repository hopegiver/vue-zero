<template>
  <div class="page-settings">
    <h1>설정</h1>
    <div class="setting-item">
      <label>테마</label>
      <select v-model="theme">
        <option value="light">라이트</option>
        <option value="dark">다크</option>
      </select>
    </div>
    <div class="setting-item">
      <label>알림</label>
      <input type="checkbox" v-model="notifications" />
      <span>{{ notifications ? '켜짐' : '꺼짐' }}</span>
    </div>
    <div class="setting-item">
      <label>언어</label>
      <select v-model="lang">
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
    </div>
    <AppButton @click="save">저장</AppButton>
    <p v-if="saved" class="saved">설정이 저장되었습니다.</p>
    <router-link to="/">← Home</router-link>
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

<style>
.page-settings { padding: 2rem; max-width: 400px; }
.page-settings h1 { color: #35495e; }
.setting-item { margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; }
.setting-item label { min-width: 60px; font-weight: bold; }
.setting-item select { padding: 0.3rem; border: 1px solid #ddd; border-radius: 4px; }
.page-settings .saved { color: #42b883; font-weight: bold; }
.page-settings a { color: #42b883; display: inline-block; margin-top: 1rem; }
</style>
