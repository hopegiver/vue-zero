<template>
  <div class="page-dashboard">
    <h1>대시보드</h1>
    <div class="stats-grid">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-change" :class="stat.trend">{{ stat.change }}</div>
      </div>
    </div>
    <div class="dashboard-sections">
      <div class="section">
        <h2>최근 활동</h2>
        <div class="user-cards">
          <UserCard v-for="user in activeUsers" :key="user.name"
            :name="user.name" :role="user.role" :color="user.color"
            @select="selectedUser = user.name" />
        </div>
        <p v-if="selectedUser" class="selected-info">선택: {{ selectedUser }}</p>
      </div>
      <div class="section">
        <h2>알림 {{ unreadCount > 0 ? '(' + unreadCount + ')' : '' }}</h2>
        <ul>
          <li v-for="notification in notifications" :key="notification.id"
              :class="{ unread: !notification.read }" @click="markRead(notification)">
            {{ notification.text }}
          </li>
        </ul>
        <AppButton v-if="unreadCount > 0" @click="markAllRead">모두 읽음</AppButton>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  title: '대시보드',
  requiresAuth: true,
  data() {
    return {
      selectedUser: null,
      stats: [
        { label: '총 사용자', value: '1,234', change: '+12%', trend: 'up' },
        { label: '오늘 방문', value: '89', change: '+5%', trend: 'up' },
        { label: '전환율', value: '3.2%', change: '-0.5%', trend: 'down' },
        { label: '매출', value: '₩2.4M', change: '+18%', trend: 'up' },
      ],
      activeUsers: [
        { name: '김철수', role: '개발자', color: '#42b883' },
        { name: '이영희', role: '디자이너', color: '#3b82f6' },
        { name: '박민수', role: 'PM', color: '#f59e0b' },
      ],
      notifications: [
        { id: 1, text: '서버 점검이 예정되어 있습니다.', read: false },
        { id: 2, text: '새로운 버전이 배포되었습니다.', read: false },
        { id: 3, text: '월간 리포트가 생성되었습니다.', read: true },
      ],
    }
  },
  computed: {
    unreadCount() {
      return this.notifications.filter(n => !n.read).length
    }
  },
  methods: {
    markRead(notification) {
      notification.read = true
    },
    markAllRead() {
      this.notifications.forEach(n => { n.read = true })
    }
  }
}
</script>

<style>
.page-dashboard { padding: 2rem; }
.page-dashboard h1 { color: #35495e; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card {
  background: #fff; padding: 1rem; border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08); text-align: center;
}
.stat-value { font-size: 1.5rem; font-weight: bold; color: #35495e; }
.stat-label { color: #888; font-size: 0.85rem; margin: 0.25rem 0; }
.stat-change { font-size: 0.8rem; font-weight: bold; }
.stat-change.up { color: #42b883; }
.stat-change.down { color: #e74c3c; }
.dashboard-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.section { background: #fff; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.section h2 { color: #35495e; font-size: 1rem; margin: 0 0 0.75rem; }
.section ul { padding: 0; margin: 0; }
.section li { list-style: none; padding: 0.4rem 0; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem; }
.section li.unread { font-weight: bold; cursor: pointer; }
.user-cards { display: flex; flex-direction: column; gap: 0.5rem; }
.selected-info { color: #42b883; font-weight: bold; margin-top: 0.5rem; font-size: 0.85rem; }
</style>
