<template>
  <div class="container py-4 text-center">
    <h1 class="mb-3">카운터</h1>
    <div class="card p-4 mb-3">
      <p class="display-4 fw-bold mb-1 text-primary">{{ count }}</p>
      <p class="text-muted small mb-3">x2 = {{ doubled }}</p>
      <div class="d-flex gap-2 justify-content-center mb-3">
        <button class="btn btn-outline-secondary btn-sm" @click="count--">-1</button>
        <button class="btn btn-outline-secondary btn-sm" @click="count++">+1</button>
        <button class="btn btn-outline-secondary btn-sm" @click="count = 0">초기화</button>
      </div>
      <p class="text-faint small mb-0">변경 횟수: {{ changeCount }}</p>
    </div>
    <router-link to="/" class="small">← Home</router-link>
  </div>
</template>

<script>
export default {
  title: '카운터',
  data() {
    return {
      count: 0,
      changeCount: 0,
    }
  },
  computed: {
    doubled() {
      return this.count * 2
    }
  },
  watch: {
    count() {
      this.changeCount++
    }
  }
}
</script>
