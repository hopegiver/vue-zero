import { Hono } from 'hono'
import * as galleryDao from '../dao/gallery.js'

const router = new Hono()

router.get('/', (c) => {
  return c.json({ items: galleryDao.findAll() })
})

router.get('/posts/:userId', (c) => {
  const posts = galleryDao.findPostsByUserId(c.req.param('userId'))
  return c.json({ posts })
})

export default router
