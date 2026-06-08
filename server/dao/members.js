const members = [
  { id: 1, name: '김철수', email: 'kim@example.com', role: 'admin', joinDate: '2024-01-15' },
  { id: 2, name: '이영희', email: 'lee@example.com', role: 'user', joinDate: '2024-02-20' },
  { id: 3, name: '박민수', email: 'park@example.com', role: 'user', joinDate: '2024-03-10' },
  { id: 4, name: '최지은', email: 'choi@example.com', role: 'banned', joinDate: '2024-04-05' },
  { id: 5, name: '정하늘', email: 'jung@example.com', role: 'user', joinDate: '2024-05-12' },
  { id: 6, name: '강서윤', email: 'kang@example.com', role: 'admin', joinDate: '2024-06-01' },
]

const names = ['김철수','이영희','박민수','최지은','정하늘','강서윤','윤도현','임수아','한재민','오유진',
               '배성호','조은비','송태양','류미래','권지훈','황보람','안세진','문하은','장동욱','노시연']
const roles = ['개발자','디자이너','PM','QA','마케터']
const statuses = ['active','inactive','pending']

const tableData = names.map((name, i) => ({
  id: i + 1,
  name,
  role: roles[i % roles.length],
  score: Math.floor(Math.random() * 100) + 1,
  status: statuses[i % statuses.length],
}))

export default class MembersDao {
  constructor(env) { this.env = env }

  findAll() { return members }
  getTableData() { return tableData }
}
