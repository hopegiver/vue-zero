export function ok(c, data) {
  return c.json(data)
}

export function notFound(c, message = 'Not found') {
  return c.json({ error: message }, 404)
}

export function badRequest(c, message = 'Bad request') {
  return c.json({ error: message }, 400)
}

export function serverError(c, message = 'Internal server error') {
  return c.json({ error: message }, 500)
}
