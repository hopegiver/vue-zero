const items = [
  { id: 1, title: '산', icon: '🏔️', color: '#e8f5e9', category: '자연', size: '2.4MB', description: '눈 덮인 산봉우리의 장엄한 풍경입니다.' },
  { id: 2, title: '바다', icon: '🌊', color: '#e3f2fd', category: '자연', size: '3.1MB', description: '푸른 바다와 하얀 파도의 아름다운 풍경입니다.' },
  { id: 3, title: '도시', icon: '🏙️', color: '#f3e5f5', category: '도시', size: '1.8MB', description: '밤에 빛나는 도시의 스카이라인입니다.' },
  { id: 4, title: '숲', icon: '🌲', color: '#e8f5e9', category: '자연', size: '2.7MB', description: '울창한 숲 속의 고요한 산책로입니다.' },
  { id: 5, title: '일몰', icon: '🌅', color: '#fff3e0', category: '풍경', size: '4.2MB', description: '황금빛 일몰이 하늘을 물들이고 있습니다.' },
  { id: 6, title: '카페', icon: '☕', color: '#efebe9', category: '도시', size: '1.5MB', description: '따뜻한 분위기의 아늑한 카페입니다.' },
  { id: 7, title: '정원', icon: '🌷', color: '#fce4ec', category: '자연', size: '2.0MB', description: '다양한 꽃이 만발한 아름다운 정원입니다.' },
  { id: 8, title: '다리', icon: '🌉', color: '#e0f2f1', category: '건축', size: '3.5MB', description: '야경이 아름다운 현수교의 모습입니다.' },
]

const posts = [
  { id: 1, title: '첫 번째 게시글' },
  { id: 2, title: '두 번째 게시글' },
  { id: 3, title: 'Vue.js 시작하기' },
]

export default class GalleryDao {
  constructor(env) { this.env = env }

  findAll() { return items }
  findPostsByUserId(userId) { return posts }
}
