import { Hono } from 'hono'
import { cors } from 'hono/cors'
import usersRouter from './routes/users.js'

const app = new Hono()

app.use('/api/*', cors())

app.route('/api/users', usersRouter)

export default app
