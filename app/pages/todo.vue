<template>
  <div class="page-todo">
    <h1>할일 관리</h1>
    <div class="todo-input">
      <input v-model="newTodo" placeholder="할일 입력..." @keyup.enter="addTodo" />
      <AppButton @click="addTodo">추가</AppButton>
    </div>
    <div class="todo-filters">
      <span :class="{ active: filter === 'all' }" @click="filter = 'all'">전체 ({{ todos.length }})</span>
      <span :class="{ active: filter === 'active' }" @click="filter = 'active'">미완료 ({{ activeTodos.length }})</span>
      <span :class="{ active: filter === 'done' }" @click="filter = 'done'">완료 ({{ doneTodos.length }})</span>
    </div>
    <ul>
      <li v-for="todo in filteredTodos" :key="todo.id" :class="{ done: todo.done }">
        <input type="checkbox" :checked="todo.done" @change="toggle(todo)" />
        <span v-if="editingId !== todo.id" @dblclick="startEdit(todo)">{{ todo.text }}</span>
        <input v-else v-model="editText" @keyup.enter="finishEdit(todo)" @blur="finishEdit(todo)" class="edit-input" />
        <button class="delete-btn" @click="remove(todo)">×</button>
      </li>
    </ul>
    <p v-if="filteredTodos.length === 0" class="empty">항목이 없습니다.</p>
    <div v-if="doneTodos.length > 0" class="todo-actions">
      <AppButton @click="clearDone">완료 항목 삭제</AppButton>
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

<style>
.page-todo { padding: 2rem; max-width: 500px; }
.page-todo h1 { color: #35495e; }
.todo-input { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.todo-input input { flex: 1; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.todo-filters { display: flex; gap: 1rem; margin-bottom: 1rem; }
.todo-filters span { cursor: pointer; color: #888; padding: 0.25rem 0.5rem; border-radius: 4px; }
.todo-filters span.active { color: #42b883; font-weight: bold; background: #f0faf5; }
.page-todo ul { padding: 0; }
.page-todo li {
  list-style: none; display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem; border-bottom: 1px solid #eee;
}
.page-todo li.done span { text-decoration: line-through; color: #aaa; }
.page-todo .edit-input { flex: 1; padding: 0.25rem; border: 1px solid #42b883; border-radius: 4px; }
.page-todo .delete-btn {
  background: none; border: none; color: #e74c3c; cursor: pointer;
  font-size: 1.2rem; margin-left: auto; padding: 0 0.25rem;
}
.page-todo .empty { color: #888; text-align: center; }
.todo-actions { margin-top: 1rem; }
</style>
