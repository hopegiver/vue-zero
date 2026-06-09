<template>
  <div class="container py-4">
    <h1 class="mb-3">탭 컴포넌트</h1>
    <div class="card overflow-hidden">
      <ul class="nav nav-tabs px-3 pt-3">
        <li class="nav-item" v-for="tab in tabs" :key="tab.key">
          <a class="nav-link" :class="{ active: activeTab === tab.key }" href="#" @click.prevent="switchTab(tab.key)">{{ tab.label }}</a>
        </li>
      </ul>
      <div class="p-4">
        <div v-if="activeTab === 'profile'">
          <h2 class="h6 mb-3">프로필</h2>
          <div class="mb-3">
            <label class="form-label small fw-bold">이름</label>
            <input v-model="profile.name" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-bold">소개</label>
            <textarea v-model="profile.bio" class="form-control" rows="3"></textarea>
          </div>
          <div>
            <label class="form-label small fw-bold">웹사이트</label>
            <input v-model="profile.website" class="form-control" />
          </div>
        </div>
        <div v-if="activeTab === 'security'">
          <h2 class="h6 mb-3">보안</h2>
          <p class="fw-bold small">비밀번호 변경</p>
          <input type="password" v-model="security.current" class="form-control mb-2" placeholder="현재 비밀번호" />
          <input type="password" v-model="security.newPass" class="form-control mb-2" placeholder="새 비밀번호" />
          <input type="password" v-model="security.confirm" class="form-control mb-2" placeholder="비밀번호 확인" />
          <p v-if="security.newPass && security.confirm && security.newPass !== security.confirm" class="text-danger small mb-0">비밀번호가 일치하지 않습니다.</p>
        </div>
        <div v-if="activeTab === 'notifications'">
          <h2 class="h6 mb-3">알림 설정</h2>
          <div class="mb-3" v-for="item in notifSettings" :key="item.key">
            <div class="form-check">
              <input class="form-check-input" type="checkbox" v-model="item.enabled" :id="item.key" />
              <label class="form-check-label fw-bold small" :for="item.key">{{ item.label }}</label>
            </div>
            <span class="text-faint small ms-4">{{ item.desc }}</span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-3 mt-4 pt-3 border-top">
          <AppButton @click="save">저장</AppButton>
          <span v-if="savedMessage" class="small fw-bold text-success-custom">{{ savedMessage }}</span>
        </div>
      </div>
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
