<template>
  <div class="page-admin-members">
    <h1>회원 관리</h1>
    <div class="member-controls">
      <input v-model="search" placeholder="이름 또는 이메일 검색..." />
      <select v-model="roleFilter">
        <option value="">전체 역할</option>
        <option value="admin">관리자</option>
        <option value="user">일반회원</option>
        <option value="banned">차단됨</option>
      </select>
    </div>
    <table>
      <thead>
        <tr>
          <th>이름</th>
          <th>이메일</th>
          <th>역할</th>
          <th>가입일</th>
          <th>작업</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in filtered" :key="member.id">
          <td>{{ member.name }}</td>
          <td>{{ member.email }}</td>
          <td>
            <select :value="member.role" @change="changeRole(member, $event.target.value)">
              <option value="admin">관리자</option>
              <option value="user">일반회원</option>
              <option value="banned">차단됨</option>
            </select>
          </td>
          <td>{{ member.joinDate }}</td>
          <td>
            <AppButton @click="confirmDelete(member)">삭제</AppButton>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="filtered.length === 0" class="empty">검색 결과가 없습니다.</p>
    <div v-if="deleteTarget" class="confirm-overlay" @click.self="deleteTarget = null">
      <div class="confirm-box">
        <p><strong>{{ deleteTarget.name }}</strong>님을 삭제하시겠습니까?</p>
        <div class="confirm-actions">
          <AppButton @click="doDelete">삭제</AppButton>
          <AppButton @click="deleteTarget = null">취소</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'admin',
  title: '회원 관리',
  data() {
    return {
      search: '',
      roleFilter: '',
      deleteTarget: null,
      members: [
        { id: 1, name: '김철수', email: 'kim@example.com', role: 'admin', joinDate: '2024-01-15' },
        { id: 2, name: '이영희', email: 'lee@example.com', role: 'user', joinDate: '2024-02-20' },
        { id: 3, name: '박민수', email: 'park@example.com', role: 'user', joinDate: '2024-03-10' },
        { id: 4, name: '최지은', email: 'choi@example.com', role: 'banned', joinDate: '2024-04-05' },
        { id: 5, name: '정하늘', email: 'jung@example.com', role: 'user', joinDate: '2024-05-12' },
        { id: 6, name: '강서윤', email: 'kang@example.com', role: 'admin', joinDate: '2024-06-01' },
      ]
    }
  },
  computed: {
    filtered() {
      return this.members.filter(m => {
        const q = this.search.toLowerCase()
        const matchSearch = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        const matchRole = !this.roleFilter || m.role === this.roleFilter
        return matchSearch && matchRole
      })
    }
  },
  methods: {
    changeRole(member, role) {
      member.role = role
    },
    confirmDelete(member) {
      this.deleteTarget = member
    },
    doDelete() {
      this.members = this.members.filter(m => m.id !== this.deleteTarget.id)
      this.deleteTarget = null
    }
  }
}
</script>

<style>
.page-admin-members h1 { color: #1a1a2e; margin-top: 0; }
.member-controls { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
.member-controls input { flex: 1; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.member-controls select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.page-admin-members table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; }
.page-admin-members th, .page-admin-members td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
.page-admin-members th { background: #f8f8f8; color: #35495e; font-size: 0.85rem; }
.page-admin-members td select { padding: 0.25rem; border: 1px solid #ddd; border-radius: 4px; }
.page-admin-members .empty { color: #888; text-align: center; }
.confirm-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.confirm-box { background: #fff; padding: 1.5rem; border-radius: 8px; text-align: center; min-width: 280px; }
.confirm-actions { display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem; }
</style>
