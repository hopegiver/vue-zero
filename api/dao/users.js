const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
]

export function findAll() {
  return users
}

export function findById(id) {
  return users.find(u => u.id === Number(id)) ?? null
}
