<template>
  <div class="container py-4">
    <h1 class="mb-3">할일 관리</h1>
    <div class="card p-3 mb-3">
      <div class="d-flex gap-2">
        <input v-model="newTodo" class="form-control" placeholder="할일 입력..." @keyup.enter="addTodo" />
        <AppButton @click="addTodo">추가</AppButton>
      </div>
    </div>
    <div class="d-flex gap-3 mb-3">
      <span role="button" class="small" :class="filter === 'all' ? 'fw-bold' : 'text-muted'" @click="filter = 'all'">전체 ({{ todos.length }})</span>
      <span role="button" class="small" :class="filter === 'active' ? 'fw-bold' : 'text-muted'" @click="filter = 'active'">미완료 ({{ activeTodos.length }})</span>
      <span role="button" class="small" :class="filter === 'done' ? 'fw-bold' : 'text-muted'" @click="filter = 'done'">완료 ({{ doneTodos.length }})</span>
    </div>
    <div class="card overflow-hidden mb-3">
      <ul class="list-unstyled mb-0">
        <li v-for="todo in filteredTodos" :key="todo.id" class="d-flex align-items-center gap-2 px-3 py-2 border-bottom">
          <input type="checkbox" class="form-check-input flex-shrink-0" :checked="todo.done" @change="toggle(todo)" />
          <span v-if="editingId !== todo.id" @dblclick="startEdit(todo)" class="flex-grow-1 small" :class="{ 'text-decoration-line-through text-muted': todo.done }">{{ todo.text }}</span>
          <input v-else v-model="editText" class="form-control form-control-sm flex-grow-1" @keyup.enter="finishEdit(todo)" @blur="finishEdit(todo)" />
          <button class="btn btn-sm text-danger p-0 ms-auto lh-1" @click="remove(todo)">&times;</button>
        </li>
      </ul>
    </div>
    <p v-if="filteredTodos.length === 0" class="text-muted text-center small">항목이 없습니다.</p>
    <div v-if="doneTodos.length > 0">
      <button class="btn btn-outline-secondary btn-sm" @click="clearDone">완료 항목 삭제</button>
    </div>
  </div>
</template>

<script>
export default {
  title: '할일 관리',
  data() {
    return {
      newTodo: '',
      todos: [],
      nextId: 1,
      filter: 'all',
      editingId: null,
      editText: '',
    }
  },
  computed: {
    activeTodos() {
      return this.todos.filter(t => !t.done)
    },
    doneTodos() {
      return this.todos.filter(t => t.done)
    },
    filteredTodos() {
      if (this.filter === 'active') return this.activeTodos
      if (this.filter === 'done') return this.doneTodos
      return this.todos
    }
  },
  methods: {
    addTodo() {
      const text = this.newTodo.trim()
      if (!text) return
      this.todos.push({ id: this.nextId++, text, done: false })
      this.newTodo = ''
    },
    toggle(todo) {
      todo.done = !todo.done
    },
    remove(todo) {
      this.todos = this.todos.filter(t => t.id !== todo.id)
    },
    startEdit(todo) {
      this.editingId = todo.id
      this.editText = todo.text
    },
    finishEdit(todo) {
      const text = this.editText.trim()
      if (text) todo.text = text
      this.editingId = null
    },
    clearDone() {
      this.todos = this.todos.filter(t => !t.done)
    }
  }
}
</script>
