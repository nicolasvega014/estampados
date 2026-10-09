import handler from '../../api/mercadopago-webhook.js'
import { runVercelHandler } from './_vercel-adapter.mjs'

export default function mercadoPagoWebhook(request) {
  return runVercelHandler(request, handler)
}
