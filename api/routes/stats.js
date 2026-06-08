import { Hono } from 'hono'
import * as statsDao from '../dao/stats.js'

const router = new Hono()

router.get('/dashboard', (c) => {
  return c.json(statsDao.getDashboard())
})

export default router
