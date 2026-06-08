import { Hono } from 'hono'
import { cors } from 'hono/cors'
import register from './_registry.js'

const app = new Hono()
app.use('/api/*', cors())
register(app)

export default app
