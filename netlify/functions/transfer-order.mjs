import handler from '../../api/transfer-order.js'
import { runVercelHandler } from './_vercel-adapter.mjs'

export default async function transferOrder(request) {
  const response = await runVercelHandler(request, handler)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export const config = { rateLimit: { action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowSize: 60, windowLimit: 10 } }
