<template>
  <div class="page-contact">
    <h1>{{ heading }}</h1>
    <form @submit.prevent="send">
      <input v-model="name" placeholder="이름" />
      <input v-model="email" type="email" placeholder="이메일" />
      <textarea v-model="message" placeholder="메시지" rows="4"></textarea>
      <AppButton @click="send">보내기</AppButton>
    </form>
    <p v-if="sent" class="success">메시지가 전송되었습니다!</p>
  </div>
</template>

<script>
export default {
  title: '문의하기',
  data() {
    return {
      heading: '문의하기',
      name: '',
      email: '',
      message: '',
      sent: false,
    }
  },
  methods: {
    send() {
      if (!this.name || !this.email || !this.message) return
      this.sent = true
      this.name = ''
      this.email = ''
      this.message = ''
    }
  }
}
</script>

<style>
.page-contact { padding: 2rem; max-width: 480px; }
.page-contact h1 { color: #35495e; }
.page-contact input,
.page-contact textarea {
  display: block; width: 100%; padding: 0.5rem; margin-bottom: 0.75rem;
  border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;
}
.page-contact .success { color: #42b883; font-weight: bold; }
</style>
