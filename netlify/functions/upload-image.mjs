import handler from '../../api/upload-image.js'
import { runVercelHandler } from './_vercel-adapter.mjs'

export default function uploadImage(request) {
  return runVercelHandler(request, handler)
}
