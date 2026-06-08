import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import statsRouter from './routes/stats.js'
import membersRouter from './routes/members.js'
import galleryRouter from './routes/gallery.js'

const app = new Hono()

app.use('/api/*', cors())

app.route('/api/auth', authRouter)
app.route('/api/users', usersRouter)
app.route('/api/stats', statsRouter)
app.route('/api/members', membersRouter)
app.route('/api/gallery', galleryRouter)

export default app
