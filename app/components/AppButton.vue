<template>
  <button class="app-button" @click="$emit('click')">
    <slot />
  </button>
</template>

<script>
export default {
  emits: ['click'],
}
</script>

<style>
.app-button {
  display: inline-block;
  padding: 0.5rem 1.2rem;
  background: #42b883;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}
.app-button:hover { background: #33a06f; }
</style>
