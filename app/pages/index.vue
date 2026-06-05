<template>
  <div class="page-home">
    <h1>{{ title }}</h1>
    <p>vue-zero 예제 앱입니다.</p>
    <nav>
      <router-link to="/about">About</router-link> |
      <router-link to="/users">Users</router-link>
    </nav>
    <AppButton @click="greet">인사하기</AppButton>
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: 'vue-zero Home',
      message: '',
    }
  },
  methods: {
    greet() {
      this.message = '안녕하세요! vue-zero 입니다.'
    }
  }
}
</script>

<style>
.page-home { padding: 2rem; }
.page-home h1 { color: #42b883; }
.page-home nav { margin: 1rem 0; }
.page-home nav a { margin-right: 0.5rem; color: #42b883; }
</style>
