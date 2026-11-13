import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectDir = fileURLToPath(new URL('../', import.meta.url))
const outputDir = path.join(projectDir, 'dist')
const origin = 'https://fenixis.com.ar'
const pages = [
  {
    path: '/',
    title: 'Fenixis Store | Tienda de ropa online',
    description: 'Descubrí prendas para todos tus días en Fenixis Store. Explorá el catálogo, elegí tu talle y color y comprá online con Mercado Pago.',
    heading: 'Vestite como te gusta.',
    copy: 'Encontrá tu próxima prenda en Fenixis Store. Explorá el catálogo de ropa y elegí los talles y colores disponibles.',
  },
  {
    path: '/productos/',
    title: 'Catálogo de prendas y remerones | Fenixis Store',
    description: 'Elegí tu próxima prenda en Fenixis Store. Explorá remerones estampados y otras prendas, filtrá por talle y color y comprá online con Mercado Pago.',
    heading: 'Elegí tu próxima prenda.',
    copy: 'Descubrí los productos disponibles y elegí tus favoritos. Buscá por nombre y filtrá por tipo de prenda, talle o color.',
  },
  {
    path: '/admin/',
    title: 'Administración | Fenixis Store',
    description: 'Acceso privado al panel de administración de Fenixis Store.',
    heading: 'Administración de Fenixis Store',
    copy: 'Iniciá sesión para administrar la tienda.',
    noindex: true,
  },
]

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])

const structuredData = (page) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'Fenixis Store',
      url: `${origin}/`,
      logo: `${origin}/brand/fenixis-logo.png`,
      sameAs: ['https://www.instagram.com/fenixisstore/'],
    },
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      name: 'Fenixis Store',
      alternateName: 'Fenixis',
      url: `${origin}/`,
      inLanguage: 'es-AR',
      publisher: { '@id': `${origin}/#organization` },
    },
    {
      '@type': page.path === '/productos/' ? 'CollectionPage' : 'WebPage',
      '@id': `${origin}${page.path}#webpage`,
      url: `${origin}${page.path}`,
      name: page.title,
      description: page.description,
      inLanguage: 'es-AR',
      isPartOf: { '@id': `${origin}/#website` },
    },
  ],
})

function metadata(page) {
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)
  const canonical = `${origin}${page.path}`
  const tags = [
    '<!-- SEO:START -->',
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}" />`,
    `<link rel="canonical" href="${canonical}" />`,
  ]
  if (!page.noindex) {
    tags.push(
      '<link rel="describedby" type="text/plain" href="/llms.txt" />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="Fenixis Store" />',
      '<meta property="og:locale" content="es_AR" />',
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:url" content="${canonical}" />`,
      '<meta name="twitter:card" content="summary" />',
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<script type="application/ld+json">${JSON.stringify(structuredData(page)).replace(/</g, '\\u003c')}</script>`,
    )
  }
  return [...tags, '<!-- SEO:END -->'].join('\n    ')
}

function fallbackContent(page) {
  // Visible to every visitor until React loads; no stale prices or stock are embedded.
  const navigation = pages.filter((entry) => !entry.noindex).map((entry) => {
    const label = entry.path === '/' ? 'Inicio' : 'Productos'
    return `<a href="${entry.path}">${label}</a>`
  }).join(' · ')
  return `<main><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.copy)}</p><nav aria-label="Secciones de Fenixis Store">${navigation}</nav><noscript><p>Activá JavaScript para consultar la disponibilidad y comprar en la tienda.</p></noscript></main>`
}

const template = await readFile(path.join(outputDir, 'index.html'), 'utf8')
const headBlock = /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/
if (!headBlock.test(template) || !template.includes('<div id="root"></div>')) {
  throw new Error('No se encontraron los puntos de inserción SEO en el HTML generado.')
}

for (const page of pages) {
  const directory = path.join(outputDir, page.path.slice(1))
  await mkdir(directory, { recursive: true })
  const html = template.replace(headBlock, metadata(page)).replace('<div id="root"></div>', `<div id="root">${fallbackContent(page)}</div>`)
  await writeFile(path.join(directory, 'index.html'), html)
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((page) => !page.noindex).map((page) => `  <url><loc>${origin}${page.path}</loc></url>`).join('\n')}\n</urlset>\n`
await writeFile(path.join(outputDir, 'sitemap.xml'), sitemap)
console.log(`SEO: ${pages.length} páginas con metadatos y mapa del sitio generados.`)
