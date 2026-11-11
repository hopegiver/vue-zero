<template>
  <h1 data-testid="page">{{ n }}</h1>
</template>

<script setup>
import { ref } from 'vue'
const n = ref(0)
</script>
