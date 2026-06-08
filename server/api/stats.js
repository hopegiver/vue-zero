import { Hono } from 'hono'
import StatsDao from '../dao/stats.js'

const router = new Hono()

router.get('/dashboard', (c) => {
  const dao = new StatsDao(c.env)
  return c.json(dao.getDashboard())
})

export default router
