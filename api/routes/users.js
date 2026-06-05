import { Hono } from 'hono'
import * as usersDao from '../dao/users.js'

const router = new Hono()

router.get('/', (c) => {
  return c.json({ users: usersDao.findAll() })
})

router.get('/:id', (c) => {
  const user = usersDao.findById(c.req.param('id'))
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json({ user })
})

export default router
