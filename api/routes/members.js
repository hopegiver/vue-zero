import { Hono } from 'hono'
import * as membersDao from '../dao/members.js'

const router = new Hono()

router.get('/', (c) => {
  return c.json({ members: membersDao.findAllMembers() })
})

router.get('/table', (c) => {
  return c.json({ items: membersDao.getTableData() })
})

export default router
