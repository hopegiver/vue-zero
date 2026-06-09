<template>
  <div class="container py-4">
    <h1 class="mb-3">이미지 갤러리</h1>
    <div class="d-flex gap-2 mb-3">
      <button class="btn btn-sm" :class="viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'" @click="viewMode = 'grid'">그리드</button>
      <button class="btn btn-sm" :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-secondary'" @click="viewMode = 'list'">리스트</button>
    </div>
    <div :class="viewMode === 'grid' ? 'row g-3' : ''">
      <div v-for="item in items" :key="item.id"
           :class="viewMode === 'grid' ? 'col-6 col-md-3' : 'mb-2'"
           role="button" @click="openModal(item)">
        <div class="card overflow-hidden" :class="viewMode === 'list' ? 'd-flex flex-row' : ''">
          <div class="d-flex align-items-center justify-content-center"
               :class="viewMode === 'grid' ? 'gallery-thumb-grid' : 'gallery-thumb-list'"
               :style="{ background: item.color }">
            <span>{{ item.icon }}</span>
          </div>
          <div class="p-2">
            <strong class="d-block small">{{ item.title }}</strong>
            <span class="text-faint text-eyebrow">{{ item.category }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="selectedItem" class="modal-overlay" @click.self="closeModal">
      <div class="card p-4 text-center modal-card gallery-modal">
        <div class="d-flex align-items-center justify-content-center rounded-2 mb-3 gallery-thumb-modal" :style="{ background: selectedItem.color }">
          <span>{{ selectedItem.icon }}</span>
        </div>
        <h2 class="h5 mb-2">{{ selectedItem.title }}</h2>
        <p class="text-muted small">{{ selectedItem.description }}</p>
        <p class="text-faint small">카테고리: {{ selectedItem.category }} | 크기: {{ selectedItem.size }}</p>
        <AppButton @click="closeModal">닫기</AppButton>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  title: '갤러리',
  data() {
    return {
      viewMode: 'grid',
      selectedItem: null,
      items: [],
    }
  },
  async mounted() {
    try {
      const res = await fetch('/api/gallery')
      if (!res.ok) throw new Error()
      const data = await res.json()
      this.items = data.items
    } catch {
      this.items = []
    }
  },
  methods: {
    openModal(item) {
      this.selectedItem = item
    },
    closeModal() {
      this.selectedItem = null
    }
  }
}
</script>
