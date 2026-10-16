import handler from '../../api/admin-order.js'
import { runVercelHandler } from './_vercel-adapter.mjs'

export default function adminOrder(request) {
  return runVercelHandler(request, handler)
}
