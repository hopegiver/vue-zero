<template>
  <div class="page-tabs">
    <h1>탭 컴포넌트</h1>
    <div class="tab-bar">
      <span v-for="tab in tabs" :key="tab.key"
            :class="{ active: activeTab === tab.key }"
            @click="switchTab(tab.key)">
        {{ tab.label }}
      </span>
    </div>
    <div class="tab-content">
      <div v-if="activeTab === 'profile'">
        <h2>프로필</h2>
        <div class="profile-form">
          <label>이름</label>
          <input v-model="profile.name" />
          <label>소개</label>
          <textarea v-model="profile.bio" rows="3"></textarea>
          <label>웹사이트</label>
          <input v-model="profile.website" />
        </div>
      </div>
      <div v-if="activeTab === 'security'">
        <h2>보안</h2>
        <div class="security-section">
          <p><strong>비밀번호 변경</strong></p>
          <input type="password" v-model="security.current" placeholder="현재 비밀번호" />
          <input type="password" v-model="security.newPass" placeholder="새 비밀번호" />
          <input type="password" v-model="security.confirm" placeholder="비밀번호 확인" />
          <p v-if="security.newPass && security.confirm && security.newPass !== security.confirm" class="error">비밀번호가 일치하지 않습니다.</p>
        </div>
      </div>
      <div v-if="activeTab === 'notifications'">
        <h2>알림 설정</h2>
        <div class="notif-item" v-for="item in notifSettings" :key="item.key">
          <label>
            <input type="checkbox" v-model="item.enabled" />
            {{ item.label }}
          </label>
          <span class="notif-desc">{{ item.desc }}</span>
        </div>
      </div>
    </div>
    <div class="tab-actions">
      <AppButton @click="save">저장</AppButton>
      <span v-if="savedMessage" class="saved">{{ savedMessage }}</span>
    </div>
  </div>
</template>

<script>
export default {
  title: '탭 컴포넌트',
  data() {
    return {
      activeTab: 'profile',
      tabs: [
        { key: 'profile', label: '프로필' },
        { key: 'security', label: '보안' },
        { key: 'notifications', label: '알림' },
      ],
      profile: { name: '홍길동', bio: 'vue-zero 개발자', website: '' },
      security: { current: '', newPass: '', confirm: '' },
      notifSettings: [
        { key: 'email', label: '이메일 알림', desc: '중요 알림을 이메일로 받습니다.', enabled: true },
        { key: 'push', label: '푸시 알림', desc: '브라우저 푸시 알림을 받습니다.', enabled: false },
        { key: 'marketing', label: '마케팅 알림', desc: '프로모션 및 이벤트 소식을 받습니다.', enabled: false },
      ],
      savedMessage: '',
    }
  },
  methods: {
    switchTab(key) {
      this.activeTab = key
      this.$router.replace({ query: { tab: key } })
    },
    save() {
      this.savedMessage = '저장되었습니다!'
      setTimeout(() => { this.savedMessage = '' }, 2000)
    }
  },
  mounted() {
    const tab = this.$route.query.tab
    if (tab && this.tabs.some(t => t.key === tab)) {
      this.activeTab = tab
    }
  }
}
</script>

<style>
.page-tabs { padding: 2rem; max-width: 600px; }
.page-tabs h1 { color: #35495e; }
.tab-bar { display: flex; border-bottom: 2px solid #eee; margin-bottom: 1.5rem; }
.tab-bar span {
  padding: 0.5rem 1rem; cursor: pointer; color: #888;
  border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s;
}
.tab-bar span.active { color: #42b883; border-bottom-color: #42b883; font-weight: bold; }
.tab-bar span:hover { color: #35495e; }
.tab-content h2 { color: #35495e; font-size: 1.1rem; margin: 0 0 1rem; }
.profile-form label { display: block; font-weight: bold; margin: 0.75rem 0 0.25rem; color: #555; }
.profile-form input,
.profile-form textarea {
  display: block; width: 100%; padding: 0.5rem;
  border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;
}
.security-section input {
  display: block; width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;
  border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;
}
.security-section .error { color: #e74c3c; font-size: 0.85rem; }
.notif-item { margin-bottom: 0.75rem; }
.notif-item label { font-weight: bold; cursor: pointer; }
.notif-desc { display: block; color: #888; font-size: 0.85rem; margin-left: 1.5rem; }
.tab-actions { margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem; }
.tab-actions .saved { color: #42b883; font-weight: bold; }
</style>
