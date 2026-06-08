<template>
  <div class="page-gallery">
    <h1>이미지 갤러리</h1>
    <div class="gallery-controls">
      <span :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">그리드</span>
      <span :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">리스트</span>
    </div>
    <div :class="['gallery', viewMode]">
      <div v-for="item in items" :key="item.id" class="gallery-item" @click="openModal(item)">
        <div class="gallery-thumb" :style="{ background: item.color }">
          <span>{{ item.icon }}</span>
        </div>
        <div class="gallery-info">
          <strong>{{ item.title }}</strong>
          <span>{{ item.category }}</span>
        </div>
      </div>
    </div>
    <div v-if="selectedItem" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-thumb" :style="{ background: selectedItem.color }">
          <span>{{ selectedItem.icon }}</span>
        </div>
        <h2>{{ selectedItem.title }}</h2>
        <p>{{ selectedItem.description }}</p>
        <p class="modal-meta">카테고리: {{ selectedItem.category }} | 크기: {{ selectedItem.size }}</p>
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

<style>
.page-gallery { padding: 2rem; }
.page-gallery h1 { color: #35495e; }
.gallery-controls { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.gallery-controls span { cursor: pointer; padding: 0.25rem 0.75rem; border-radius: 4px; color: #888; }
.gallery-controls span.active { background: #42b883; color: #fff; }
.gallery.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; }
.gallery.list { display: flex; flex-direction: column; gap: 0.5rem; }
.gallery.list .gallery-item { flex-direction: row; }
.gallery-item { cursor: pointer; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); transition: transform 0.2s; }
.gallery-item:hover { transform: translateY(-2px); }
.gallery-thumb { height: 100px; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
.gallery.list .gallery-thumb { width: 60px; height: 60px; font-size: 1.5rem; flex-shrink: 0; }
.gallery-info { padding: 0.5rem; }
.gallery-info strong { display: block; color: #35495e; font-size: 0.9rem; }
.gallery-info span { color: #888; font-size: 0.75rem; }
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-content { background: #fff; padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; }
.modal-thumb { height: 120px; display: flex; align-items: center; justify-content: center; font-size: 3rem; border-radius: 8px; margin-bottom: 1rem; }
.modal-content h2 { color: #35495e; margin: 0 0 0.5rem; }
.modal-content p { color: #666; }
.modal-meta { font-size: 0.8rem; color: #888; }
</style>
