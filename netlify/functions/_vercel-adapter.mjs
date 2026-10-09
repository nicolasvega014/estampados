function appendQueryValue(target, key, value) {
  if (key in target) {
    target[key] = Array.isArray(target[key]) ? [...target[key], value] : [target[key], value]
    return
  }
  target[key] = value
}

function requestHeaders(request) {
  return Object.fromEntries(
    [...request.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]),
  )
}

function requestQuery(url) {
  const query = {}
  for (const [key, value] of url.searchParams) appendQueryValue(query, key, value)
  return query
}

async function requestBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined

  const raw = await request.text()
  if (!raw) return {}

  const contentType = request.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw)
    } catch {
      return undefined
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = {}
    for (const [key, value] of new URLSearchParams(raw)) appendQueryValue(body, key, value)
    return body
  }

  return raw
}

/**
 * Lets the existing Vercel-style handlers run unchanged in a Netlify Node
 * Function. The shop's API is deliberately kept same-origin at /api/*.
 */
export async function runVercelHandler(request, handler) {
  const url = new URL(request.url)
  let statusCode = 200
  let response

  const res = {
    status(code) {
      statusCode = Number(code) || 200
      return res
    },
    json(payload) {
      response = Response.json(payload, { status: statusCode })
      return response
    },
  }

  const req = {
    method: request.method,
    headers: requestHeaders(request),
    query: requestQuery(url),
    body: await requestBody(request),
    url: `${url.pathname}${url.search}`,
  }

  const result = await handler(req, res)
  if (response) return response
  if (result instanceof Response) return result

  return Response.json(
    { message: 'La respuesta del servidor no pudo completarse.' },
    { status: 500 },
  )
}
