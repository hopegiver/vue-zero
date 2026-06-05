import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'

const app = new Hono()

app.use('/api/*', cors())

app.route('/api/auth', authRouter)
app.route('/api/users', usersRouter)

export default app
