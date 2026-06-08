<template>
  <div class="user-card" @click="$emit('select')">
    <div class="user-avatar" :style="{ background: color }">{{ initials }}</div>
    <div class="user-info">
      <strong>{{ name }}</strong>
      <span>{{ role }}</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    name: { type: String, required: true },
    role: { type: String, default: '' },
    color: { type: String, default: '#42b883' },
  },
  emits: ['select'],
  computed: {
    initials() {
      return this.name.slice(0, 1)
    }
  }
}
</script>

<style>
.user-card {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem; border-radius: 8px; cursor: pointer;
  border: 1px solid #eee; transition: box-shadow 0.2s;
}
.user-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.user-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: bold; font-size: 1.1rem; flex-shrink: 0;
}
.user-info strong { display: block; color: #35495e; }
.user-info span { color: #888; font-size: 0.85rem; }
</style>
