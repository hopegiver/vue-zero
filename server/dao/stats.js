const stats = [
  { label: '총 사용자', value: '1,234', change: '+12%', trend: 'up' },
  { label: '오늘 방문', value: '89', change: '+5%', trend: 'up' },
  { label: '전환율', value: '3.2%', change: '-0.5%', trend: 'down' },
  { label: '매출', value: '₩2.4M', change: '+18%', trend: 'up' },
]

const notifications = [
  { id: 1, text: '서버 점검이 예정되어 있습니다.', read: false },
  { id: 2, text: '새로운 버전이 배포되었습니다.', read: false },
  { id: 3, text: '월간 리포트가 생성되었습니다.', read: true },
]

const activeUsers = [
  { name: '김철수', role: '개발자', color: '#42b883' },
  { name: '이영희', role: '디자이너', color: '#3b82f6' },
  { name: '박민수', role: 'PM', color: '#f59e0b' },
]

export default class StatsDao {
  constructor(env) { this.env = env }

  getDashboard() { return { stats, notifications, activeUsers } }
}
