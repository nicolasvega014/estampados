import handler from '../../api/process-order.js'
import { runVercelHandler } from './_vercel-adapter.mjs'

export default function processOrder(request) {
  return runVercelHandler(request, handler)
}
