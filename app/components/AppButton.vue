<template>
  <button class="btn btn-primary text-nowrap" @click="$emit('click')">
    <slot />
  </button>
</template>

<script>
export default {
  emits: ['click'],
}
</script>
