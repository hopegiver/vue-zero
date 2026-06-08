import { Hono } from 'hono'
import UsersDao from '../dao/users.js'
import GalleryDao from '../dao/gallery.js'
import { notFound } from '../utils/response.js'

const router = new Hono()

router.get('/', (c) => {
  const dao = new UsersDao(c.env)
  return c.json({ users: dao.findAll() })
})

router.get('/:id', (c) => {
  const dao = new UsersDao(c.env)
  const user = dao.findById(c.req.param('id'))
  if (!user) return notFound(c)
  return c.json({ user })
})

router.get('/:id/posts', (c) => {
  const dao = new GalleryDao(c.env)
  const posts = dao.findPostsByUserId(c.req.param('id'))
  return c.json({ posts })
})

export default router
