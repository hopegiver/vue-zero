<template>
  <div class="d-flex align-items-center gap-3 p-3 bg-canvas rounded-2 border border-hairline user-card-hover" role="button" @click="$emit('select')">
    <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0 user-card-avatar"
         :style="{ background: color }">{{ initials }}</div>
    <div>
      <strong class="d-block small">{{ name }}</strong>
      <span class="text-faint text-eyebrow">{{ role }}</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    name: { type: String, required: true },
    role: { type: String, default: '' },
    color: { type: String, default: '#0075de' },
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
.user-card-hover { cursor: pointer; transition: box-shadow 0.15s; }
.user-card-hover:hover { box-shadow: var(--shadow-soft); }
.user-card-avatar { width: 36px; height: 36px; font-size: 0.875rem; }
</style>
