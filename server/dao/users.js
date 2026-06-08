const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
]

export default class UsersDao {
  constructor(env) { this.env = env }

  findAll() { return users }
  findById(id) { return users.find(u => u.id === Number(id)) ?? null }
}
