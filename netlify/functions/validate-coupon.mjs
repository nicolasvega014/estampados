import handler from '../../api/validate-coupon.js'
import { runVercelHandler } from './_vercel-adapter.mjs'

export default function validateCoupon(request) {
  return runVercelHandler(request, handler)
}
