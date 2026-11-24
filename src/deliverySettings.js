// Shared by the storefront and the payment server. Prices are Argentine pesos.
export const DEFAULT_DELIVERY_SETTINGS = Object.freeze({
  pickupAddress: 'Bogotá 5191, Ezpeleta',
  pickupHours: '',
  branchPrice: 7500,
  homePrice: 11500,
  shippingInstructions: 'Coordinamos el envío después de la compra.',
})

export const DELIVERY_OPTIONS = Object.freeze([
  { mode: 'pickup', label: 'Retiro por el local' },
  { mode: 'branch', label: 'Correo Argentino a sucursal' },
  { mode: 'home', label: 'Envío a domicilio' },
])

const text = (value, fallback, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : fallback
const price = (value, fallback) => value !== '' && value != null && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback

export function normalizeDeliverySettings(value = {}) {
  const input = value && typeof value === 'object' ? value : {}
  return {
    pickupAddress: text(input.pickupAddress, DEFAULT_DELIVERY_SETTINGS.pickupAddress, 300) || DEFAULT_DELIVERY_SETTINGS.pickupAddress,
    pickupHours: text(input.pickupHours, '', 200),
    branchPrice: price(input.branchPrice, DEFAULT_DELIVERY_SETTINGS.branchPrice),
    homePrice: price(input.homePrice, DEFAULT_DELIVERY_SETTINGS.homePrice),
    shippingInstructions: text(input.shippingInstructions, DEFAULT_DELIVERY_SETTINGS.shippingInstructions, 600) || DEFAULT_DELIVERY_SETTINGS.shippingInstructions,
  }
}

export function deliveryDetails(selection, value) {
  const option = DELIVERY_OPTIONS.find((item) => item.label === selection)
  if (!option) return null
  const settings = normalizeDeliverySettings(value)
  const pickup = option.mode === 'pickup'
  return {
    mode: option.mode,
    label: option.label,
    cost: pickup ? 0 : option.mode === 'branch' ? settings.branchPrice : settings.homePrice,
    pickupAddress: pickup ? settings.pickupAddress : '',
    pickupHours: pickup ? settings.pickupHours : '',
    instructions: pickup ? '' : settings.shippingInstructions,
  }
}
