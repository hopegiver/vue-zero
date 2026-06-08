import { Hono } from 'hono'
import GalleryDao from '../dao/gallery.js'

const router = new Hono()

router.get('/', (c) => {
  const dao = new GalleryDao(c.env)
  return c.json({ items: dao.findAll() })
})

router.get('/posts/:userId', (c) => {
  const dao = new GalleryDao(c.env)
  const posts = dao.findPostsByUserId(c.req.param('userId'))
  return c.json({ posts })
})

export default router
