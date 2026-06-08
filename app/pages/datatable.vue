<template>
  <div class="page-table">
    <h1>데이터 테이블</h1>
    <div class="table-controls">
      <input v-model="searchText" placeholder="검색..." />
      <select v-model="perPage">
        <option :value="5">5개씩</option>
        <option :value="10">10개씩</option>
        <option :value="20">20개씩</option>
      </select>
    </div>
    <table>
      <thead>
        <tr>
          <th @click="sortBy('id')" class="sortable">
            ID {{ sortKey === 'id' ? (sortAsc ? '▲' : '▼') : '' }}
          </th>
          <th @click="sortBy('name')" class="sortable">
            이름 {{ sortKey === 'name' ? (sortAsc ? '▲' : '▼') : '' }}
          </th>
          <th @click="sortBy('role')" class="sortable">
            역할 {{ sortKey === 'role' ? (sortAsc ? '▲' : '▼') : '' }}
          </th>
          <th @click="sortBy('score')" class="sortable">
            점수 {{ sortKey === 'score' ? (sortAsc ? '▲' : '▼') : '' }}
          </th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in paginatedData" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.name }}</td>
          <td>{{ row.role }}</td>
          <td>{{ row.score }}</td>
          <td><span class="badge" :class="row.status">{{ row.status }}</span></td>
        </tr>
      </tbody>
    </table>
    <div class="pagination">
      <AppButton @click="page--" v-if="page > 1">이전</AppButton>
      <span>{{ page }} / {{ totalPages }} 페이지 (총 {{ filteredData.length }}건)</span>
      <AppButton @click="page++" v-if="page < totalPages">다음</AppButton>
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
    }
  }
}
</script>

<style>
.page-table { padding: 2rem; }
.page-table h1 { color: #35495e; }
.table-controls { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
.table-controls input { flex: 1; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.table-controls select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
th { background: #f8f8f8; color: #35495e; font-size: 0.85rem; }
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { background: #eef; }
.badge { padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.75rem; }
.badge.active { background: #e6f9f0; color: #42b883; }
.badge.inactive { background: #fde8e8; color: #e74c3c; }
.badge.pending { background: #fef3cd; color: #856404; }
.pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; }
.pagination span { color: #888; font-size: 0.85rem; }
</style>
