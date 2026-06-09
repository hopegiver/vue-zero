<template>
  <div>
    <h1 class="h4 mt-0 mb-3">회원 관리</h1>
    <div class="card p-3 mb-3">
      <div class="d-flex gap-2">
        <input v-model="search" class="form-control" placeholder="이름 또는 이메일 검색..." />
        <select v-model="roleFilter" class="form-select w-auto">
          <option value="">전체 역할</option>
          <option value="admin">관리자</option>
          <option value="user">일반회원</option>
          <option value="banned">차단됨</option>
        </select>
      </div>
    </div>
    <div class="card overflow-hidden mb-3">
      <table class="table table-borderless mb-0">
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
              <select class="form-select form-select-sm w-auto" :value="member.role" @change="changeRole(member, $event.target.value)">
                <option value="admin">관리자</option>
                <option value="user">일반회원</option>
                <option value="banned">차단됨</option>
              </select>
            </td>
            <td>{{ member.joinDate }}</td>
            <td><button class="btn btn-outline-secondary btn-sm" @click="confirmDelete(member)">삭제</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="filtered.length === 0" class="text-muted text-center small">검색 결과가 없습니다.</p>
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="card p-4 text-center modal-card min-w-modal">
        <p class="mb-3"><strong>{{ deleteTarget.name }}</strong>님을 삭제하시겠습니까?</p>
        <div class="d-flex gap-2 justify-content-center">
          <button class="btn btn-danger btn-sm" @click="doDelete">삭제</button>
          <button class="btn btn-outline-secondary btn-sm" @click="deleteTarget = null">취소</button>
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
      members: [],
    }
  },
  async mounted() {
    try {
      const res = await fetch('/api/members')
      if (!res.ok) throw new Error()
      const data = await res.json()
      this.members = data.members
    } catch {
      this.members = []
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
