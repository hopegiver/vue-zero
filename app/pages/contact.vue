<template>
  <div class="container py-4">
    <h1 class="mb-3">{{ heading }}</h1>
    <div class="card p-4">
      <form @submit.prevent="send">
        <label class="form-label small fw-bold">이름</label>
        <input v-model="name" class="form-control mb-3" placeholder="이름" />
        <label class="form-label small fw-bold">이메일</label>
        <input v-model="email" type="email" class="form-control mb-3" placeholder="이메일" />
        <label class="form-label small fw-bold">메시지</label>
        <textarea v-model="message" class="form-control mb-3" placeholder="메시지" rows="4"></textarea>
        <AppButton @click="send">보내기</AppButton>
      </form>
      <p v-if="sent" class="mt-3 mb-0 small fw-bold text-success-custom">메시지가 전송되었습니다!</p>
    </div>
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
