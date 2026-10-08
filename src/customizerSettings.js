export const DEFAULT_CUSTOMIZER_COLORS = [
  { name: 'Blanco', value: '#f7f6f2' },
  { name: 'Negro', value: '#1e1e21' },
  { name: 'Arena', value: '#d9d0c3' },
  { name: 'Verde', value: '#71866c' },
  { name: 'Bordó', value: '#7d3541' },
]

export const DEFAULT_CUSTOMIZER_SIZES = ['S', 'M', 'L', 'XL', 'XXL']

const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || '').trim())

export function normalizeCustomizerSettings(data = {}) {
  const storedColors = Array.isArray(data.colors)
    ? data.colors.map((color) => ({ name: String(color?.name || '').trim().slice(0, 30), value: String(color?.value || '').trim() })).filter((color) => color.name && isHexColor(color.value))
    : []
  const storedSizes = Array.isArray(data.sizes)
    ? data.sizes.map((size) => String(size || '').trim().toUpperCase().slice(0, 8)).filter(Boolean)
    : []

  return {
    colors: storedColors.length ? storedColors : DEFAULT_CUSTOMIZER_COLORS,
    sizes: storedSizes.length ? [...new Set(storedSizes)] : DEFAULT_CUSTOMIZER_SIZES,
  }
}
