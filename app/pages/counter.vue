<template>
  <div class="page-counter">
    <h1>카운터</h1>
    <p class="count">{{ count }}</p>
    <p class="double">x2 = {{ doubled }}</p>
    <div class="buttons">
      <AppButton @click="count--">-1</AppButton>
      <AppButton @click="count++">+1</AppButton>
      <AppButton @click="count = 0">초기화</AppButton>
    </div>
    <p class="history">변경 횟수: {{ changeCount }}</p>
    <router-link to="/">← Home</router-link>
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

<style>
.page-counter { padding: 2rem; text-align: center; }
.page-counter h1 { color: #35495e; }
.page-counter .count { font-size: 3rem; font-weight: bold; color: #42b883; margin: 0.5rem 0; }
.page-counter .double { color: #888; margin-bottom: 1rem; }
.page-counter .buttons { display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1rem; }
.page-counter .history { color: #888; font-size: 0.85rem; }
.page-counter a { color: #42b883; }
</style>
