import { normalizePaymentSettings, transferAvailable } from './paymentSettings.js'

export const MAX_ANNOUNCEMENT_MESSAGES = 6
export const MAX_ANNOUNCEMENT_LENGTH = 140

export function automaticAnnouncementMessages(paymentSettings) {
  const payments = normalizePaymentSettings(paymentSettings)
  const promotion = transferAvailable(payments) && payments.transferDiscountPercent > 0
    ? `${payments.transferDiscountPercent}% OFF con transferencia`
    : 'Encontrá tu próxima prenda favorita'
  return [promotion, 'Envíos y retiro por el local']
}

export function normalizeAnnouncementSettings(value) {
  const messages = Array.isArray(value?.messages)
    ? value.messages.filter((message) => typeof message === 'string')
      .map((message) => message.replace(/\s+/g, ' ').trim().slice(0, MAX_ANNOUNCEMENT_LENGTH))
      .filter(Boolean).slice(0, MAX_ANNOUNCEMENT_MESSAGES)
    : []
  const custom = value?.mode === 'custom' && messages.length > 0
  return { enabled: value?.enabled !== false, mode: custom ? 'custom' : 'automatic', messages: custom ? messages : [] }
}

export function announcementMessages(value, paymentSettings) {
  const settings = normalizeAnnouncementSettings(value)
  return settings.mode === 'custom' ? settings.messages : automaticAnnouncementMessages(paymentSettings)
}

export function validateAnnouncementSettings(value) {
  if (value?.mode !== 'custom') return ''
  if (!Array.isArray(value.messages) || !value.messages.length || value.messages.length > MAX_ANNOUNCEMENT_MESSAGES) {
    return `Agregá entre 1 y ${MAX_ANNOUNCEMENT_MESSAGES} mensajes.`
  }
  if (value.messages.some((message) => typeof message !== 'string' || !message.trim() || message.trim().length > MAX_ANNOUNCEMENT_LENGTH)) {
    return `Completá cada mensaje con un máximo de ${MAX_ANNOUNCEMENT_LENGTH} caracteres, o quitá los que no quieras mostrar.`
  }
  return ''
}
