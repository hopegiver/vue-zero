<template>
  <div class="container py-4">
    <h1 class="mb-3">데이터 테이블</h1>
    <div class="card p-3 mb-3">
      <div class="d-flex gap-2">
        <input v-model="searchText" class="form-control" placeholder="검색..." />
        <select v-model="perPage" class="form-select w-auto">
          <option :value="5">5개씩</option>
          <option :value="10">10개씩</option>
          <option :value="20">20개씩</option>
        </select>
      </div>
    </div>
    <div class="card overflow-hidden mb-3">
      <table class="table table-borderless mb-0">
        <thead>
          <tr>
            <th role="button" @click="sortBy('id')">ID {{ sortKey === 'id' ? (sortAsc ? '▲' : '▼') : '' }}</th>
            <th role="button" @click="sortBy('name')">이름 {{ sortKey === 'name' ? (sortAsc ? '▲' : '▼') : '' }}</th>
            <th role="button" @click="sortBy('role')">역할 {{ sortKey === 'role' ? (sortAsc ? '▲' : '▼') : '' }}</th>
            <th role="button" @click="sortBy('score')">점수 {{ sortKey === 'score' ? (sortAsc ? '▲' : '▼') : '' }}</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in paginatedData" :key="row.id">
            <td>{{ row.id }}</td>
            <td>{{ row.name }}</td>
            <td>{{ row.role }}</td>
            <td>{{ row.score }}</td>
            <td><span class="badge" :class="statusBadge(row.status)">{{ row.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="d-flex align-items-center justify-content-between">
      <span class="text-faint small">총 {{ filteredData.length }}건</span>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" @click="page--" :disabled="page <= 1">← 이전</button>
        <span class="small">{{ page }} / {{ totalPages }}</span>
        <button class="btn btn-outline-secondary btn-sm" @click="page++" :disabled="page >= totalPages">다음 →</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  title: '데이터 테이블',
  data() {
    return {
      searchText: '',
      sortKey: 'id',
      sortAsc: true,
      page: 1,
      perPage: 10,
      items: [],
    }
  },
  computed: {
    filteredData() {
      const q = this.searchText.toLowerCase()
      let data = this.items
      if (q) {
        data = data.filter(r =>
          r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)
        )
      }
      data = [...data].sort((a, b) => {
        const va = a[this.sortKey]
        const vb = b[this.sortKey]
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return this.sortAsc ? cmp : -cmp
      })
      return data
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredData.length / this.perPage))
    },
    paginatedData() {
      const start = (this.page - 1) * this.perPage
      return this.filteredData.slice(start, start + this.perPage)
    }
  },
  watch: {
    searchText() { this.page = 1 },
    perPage() { this.page = 1 },
  },
  async mounted() {
    try {
      const res = await fetch('/api/members/table')
      if (!res.ok) throw new Error()
      const data = await res.json()
      this.items = data.items
    } catch {
      this.items = []
    }
  },
  methods: {
    sortBy(key) {
      if (this.sortKey === key) {
        this.sortAsc = !this.sortAsc
      } else {
        this.sortKey = key
        this.sortAsc = true
      }
    },
    statusBadge(status) {
      if (status === 'active') return 'bg-success-subtle text-success'
      if (status === 'inactive') return 'bg-danger-subtle text-danger'
      return 'bg-warning-subtle text-warning'
    }
  }
}
</script>
