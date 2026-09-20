import { useEffect, useMemo, useRef, useState } from 'react'
import Shirt3D from './Shirt3D'
import Admin from './Admin'
import './App.css'

const COLORS = [{ name: 'Blanco', value: '#f7f6f2' }, { name: 'Negro', value: '#1e1e21' }, { name: 'Arena', value: '#d9d0c3' }, { name: 'Verde', value: '#71866c' }, { name: 'Bordó', value: '#7d3541' }]
const SIZES = ['S', 'M', 'L', 'XL', 'XXL']

function Shirt({ color, design, transform, side, onPointerDown }) {
  return <Shirt3D color={color} design={design} side={side} transform={transform} onDesignPointerDown={onPointerDown}/>
  const isBack = side === 'Espalda'
  return <div className={`shirt-stage ${isBack ? 'back' : 'front'}`}><svg className="shirt" viewBox="0 0 360 440" aria-label={`Remera ${color.name}, vista ${side}`}><defs><linearGradient id="fabric" x1="0" x2=".9" y1="0" y2="1"><stop stopColor={color.value}/><stop offset=".72" stopColor={color.value}/><stop offset="1" stopColor={color.value} stopOpacity=".88"/></linearGradient><linearGradient id="light" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff" stopOpacity=".3"/><stop offset=".6" stopColor="#fff" stopOpacity="0"/></linearGradient></defs><path className="shirt-body" d="M110 47 70 66 18 116l47 70 46-30v250c43 9 101 9 138 0V156l46 30 47-70-52-50-40-19c-13 23-39 34-70 34s-57-11-70-34Z" fill="url(#fabric)"/><path className="shirt-highlight" d="M110 47 70 66 18 116l47 70 46-30v250c20 4 45 6 69 6V82c-31 0-57-11-70-35Z" fill="url(#light)"/><path className="sleeve-seam" d="m70 66 41 47m179-47-41 47"/><path className="side-seam" d="M111 156v250m138-250v250"/>{isBack ? <><path className="collar back-collar" d="M116 51c13 25 99 25 128 0"/><path className="back-yoke" d="M91 101c55 18 123 18 178 0"/></> : <><path className="collar" d="M110 47c14 45 126 45 140 0"/><path className="front-fold" d="M180 82v31"/></>}<path className="hem" d="M111 406c43 9 101 9 138 0"/></svg><div className="print-area" aria-label={`Área de estampado de la ${side.toLowerCase()}`}>{design ? <img className="user-design" src={design} alt="Diseño cargado" onPointerDown={onPointerDown} style={{ width: `${transform.scale}%`, left: `${transform.x}%`, top: `${transform.y}%`, transform: `translate(-50%, -50%) rotate(${transform.rotation}deg)` }}/> : <div className="drop-hint"><span>+</span> Tu diseño</div>}</div></div>
}

function App() {
  if (window.location.pathname === '/admin') return <Admin />
  const [color, setColor] = useState(COLORS[0]); const [size, setSize] = useState('M'); const [side, setSide] = useState('Frente'); const [designs, setDesigns] = useState({ Frente: '', Espalda: '' }); const [fileNames, setFileNames] = useState({ Frente: '', Espalda: '' }); const [notice, setNotice] = useState(''); const [transforms, setTransforms] = useState({ Frente: { x: 50, y: 43, scale: 54, rotation: 0 }, Espalda: { x: 50, y: 43, scale: 54, rotation: 0 } }); const transform = transforms[side]; const setTransform = (next) => setTransforms((current) => { const active = current[side]; return { ...current, [side]: typeof next === 'function' ? next(active) : next } }); const drag = useRef(null)
  const design = designs[side]
  const fileName = fileNames[side]
  const isCustomizerPage = window.location.pathname === '/personaliza'
  useEffect(() => {
    document.querySelectorAll('nav a').forEach((link) => { if (link.textContent === 'Cómo funciona') link.remove() })
    const designSizeRange = document.querySelector('.range')
    if (designSizeRange) designSizeRange.min = '5'
    document.querySelectorAll('a[href="#personaliza"]').forEach((link) => { link.href = '/personaliza' })
    document.querySelectorAll('a[href="#como-funciona"], a[href="/#como-funciona"]').forEach((link) => { link.href = '/personaliza' })
  }, [])
  useEffect(() => {
    if (!isCustomizerPage) return
    const savedDesign = window.localStorage.getItem('tinta-club-selected-design')
    if (!savedDesign) return
    try {
      const design = JSON.parse(savedDesign)
      if (!design?.src?.startsWith('/designs/')) return
      setDesigns((current) => ({ ...current, Frente: design.src }))
      setFileNames((current) => ({ ...current, Frente: design.name }))
      setTransform({ x: 50, y: 43, scale: 54, rotation: 0 })
      setNotice(`Diseño “${design.name}” listo para acomodar en el frente.`)
    } finally {
      window.localStorage.removeItem('tinta-club-selected-design')
    }
  }, [isCustomizerPage])
  useEffect(() => {
    if (!isCustomizerPage) return
    const upload = document.querySelector('.controls .upload')
    if (!upload) return
    const openButton = document.createElement('button')
    const picker = document.createElement('section')
    openButton.type = 'button'; openButton.className = 'browse-designs'; openButton.textContent = 'Ver diseños de la galería →'
    picker.className = 'design-picker'; picker.hidden = true
    picker.innerHTML = '<div class="design-picker-head"><strong>Elegí un diseño</strong><button type="button" aria-label="Cerrar diseños">×</button></div><div class="picker-filters"></div><div class="picker-grid"></div>'
    upload.insertAdjacentElement('afterend', openButton); openButton.insertAdjacentElement('afterend', picker)
    const closeButton = picker.querySelector('.design-picker-head button')
    const filters = picker.querySelector('.picker-filters')
    const grid = picker.querySelector('.picker-grid')
    const categories = ['Todo', 'Mascotas', 'Flores', 'Verano', 'Coquette', 'Frases', 'Moda', 'Vintage']
    let availableDesigns = []
    const render = (category = 'Todo') => {
      grid.replaceChildren()
      const visible = (category === 'Todo' ? availableDesigns : availableDesigns.filter((design) => design.category === category)).slice(0, 30)
      visible.forEach((design) => {
        const option = document.createElement('button'); const image = document.createElement('img'); const label = document.createElement('span')
        option.type = 'button'; option.dataset.src = design.src; option.dataset.name = design.name
        image.src = design.src; image.alt = design.name; image.loading = 'lazy'; label.textContent = design.name
        option.append(image, label); grid.append(option)
      })
    }
    categories.forEach((category, index) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = category; button.className = index === 0 ? 'active' : ''; button.addEventListener('click', () => { filters.querySelectorAll('button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); render(category) }); filters.append(button) })
    const openPicker = () => { picker.hidden = false; render(filters.querySelector('.active')?.textContent || 'Todo') }
    const closePicker = () => { picker.hidden = true }
    const chooseDesign = (event) => { const option = event.target.closest('[data-src]'); if (!option) return; const name = option.dataset.name; setDesigns((current) => ({ ...current, [side]: option.dataset.src })); setFileNames((current) => ({ ...current, [side]: name })); setTransform({ x: 50, y: 43, scale: 54, rotation: 0 }); setNotice(`Diseño “${name}” cargado en ${side.toLowerCase()}. Podés moverlo directamente sobre la remera.`); closePicker() }
    openButton.addEventListener('click', openPicker); closeButton.addEventListener('click', closePicker); grid.addEventListener('click', chooseDesign)
    fetch('/designs/manifest.json').then((response) => response.json()).then((items) => { availableDesigns = items; render() }).catch(() => {})
    return () => { openButton.removeEventListener('click', openPicker); closeButton.removeEventListener('click', closePicker); grid.removeEventListener('click', chooseDesign); openButton.remove(); picker.remove() }
  }, [isCustomizerPage, side])
  useEffect(() => {
    if (isCustomizerPage || document.querySelector('.collections')) return
    const featured = document.querySelector('.featured')
    if (!featured) return
    featured.insertAdjacentHTML('afterend', `<section class="collections" id="colecciones"><aside class="collections-nav"><p class="eyebrow">EXPLORÁ POR ESTILO</p><h2>Colecciones</h2><div class="collection-links"><button class="active">Todo</button><button>Anime</button><button>Flores</button><button>Gaming</button><button>Música</button><button>Deportes</button><button>Autos & motos</button><button>Mascotas</button><button>Frases</button></div></aside><div class="collection-content"><div class="collection-heading"><div><p class="eyebrow">DISEÑOS LISTOS PARA USAR</p><h2>Encontrá tu estilo.</h2></div><p>Elegí una colección o subí tu propio arte para crear una remera única.</p></div><div class="collection-grid"><article><img src="https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=800&q=80" alt="Colección Anime"/><span>ANIME</span></article><article><img src="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=80" alt="Colección Flores"/><span>FLORES</span></article><article><img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80" alt="Colección Gaming"/><span>GAMING</span></article><article><img src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80" alt="Colección Música"/><span>MÚSICA</span></article><article><img src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80" alt="Colección Deportes"/><span>DEPORTES</span></article><article><img src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80" alt="Colección Autos y motos"/><span>AUTOS & MOTOS</span></article><article><img src="https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80" alt="Colección Mascotas"/><span>MASCOTAS</span></article><article class="quote-card"><p>"HACÉ LUGAR<br/>PARA LO<br/>QUE TE<br/>HACE VOS."</p><span>FRASES</span></article></div></div></section>`)
    const buttons = document.querySelectorAll('.collection-links button')
    const categories = ['Todo', 'Mascotas', 'Flores', 'Verano', 'Coquette', 'Frases', 'Moda', 'Vintage']
    const grid = document.querySelector('.collection-grid')
    const heading = document.querySelector('.collection-heading h2')
    let designs = []
    let cancelled = false
    buttons.forEach((button, index) => { if (categories[index]) button.textContent = categories[index]; else button.remove() })
    const renderCollection = (category) => {
      if (!grid) return
      grid.replaceChildren()
      const visibleDesigns = (category === 'Todo' ? designs : designs.filter((design) => design.category === category)).slice(0, 24)
      visibleDesigns.forEach((design) => {
        const card = document.createElement('article')
        const image = document.createElement('img')
        const label = document.createElement('span')
        image.src = design.src; image.alt = design.name; image.loading = 'lazy'
        label.textContent = design.name.toUpperCase()
        card.className = 'collection-card'; card.append(image, label); card.addEventListener('click', () => { window.localStorage.setItem('tinta-club-selected-design', JSON.stringify(design)); window.location.assign('/personaliza') }); grid.append(card)
      })
      if (heading) heading.textContent = category === 'Todo' ? 'Encontrá tu estilo.' : category
    }
    fetch('/designs/manifest.json').then((response) => response.json()).then((items) => { if (!cancelled) { designs = items; renderCollection('Todo') } }).catch(() => {})
    const select = (event) => { buttons.forEach((button) => button.classList.remove('active')); event.currentTarget.classList.add('active'); renderCollection(event.currentTarget.textContent) }
    buttons.forEach((button) => button.addEventListener('click', select))
    return () => { cancelled = true; buttons.forEach((button) => button.removeEventListener('click', select)) }
  }, [isCustomizerPage])
  const whatsappMessage = useMemo(() => encodeURIComponent(`Hola, quiero pedir una remera personalizada.\nColor: ${color.name}\nTalle: ${size}\nDiseño frente: ${fileNames.Frente || 'sin diseño'}\nDiseño espalda: ${fileNames.Espalda || 'sin diseño'}`), [color, fileNames, size])
  function uploadDesign(event) { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setNotice('Elegí una imagen JPG, PNG o WEBP.'); return } if (file.size > 10 * 1024 * 1024) { setNotice('La imagen no puede superar 10 MB.'); return } const url = URL.createObjectURL(file); const image = new Image(); image.onload = () => { setDesigns(current => ({ ...current, [side]: url })); setFileNames(current => ({ ...current, [side]: file.name })); setTransform({ x: 50, y: 43, scale: 54, rotation: 0 }); setNotice(image.width < 1000 || image.height < 1000 ? 'Atención: la imagen podría verse pixelada al estampar. Recomendamos al menos 1000 px.' : `¡Diseño cargado en ${side.toLowerCase()}! Podés moverlo directamente sobre la remera.`) }; image.src = url }
  function removeDesign() { setDesigns(current => ({ ...current, [side]: '' })); setFileNames(current => ({ ...current, [side]: '' })); setNotice(`Imagen de ${side.toLowerCase()} eliminada. Podés subir otra cuando quieras.`); setTransform({ x: 50, y: 43, scale: 54, rotation: 0 }) }
  function startDrag(event) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, startX: transform.x, startY: transform.y } }
  function moveDrag(event) { if (!drag.current) return; const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(10, Math.min(90, drag.current.startX + ((event.clientX - drag.current.x) / rect.width) * 100)); const y = Math.max(10, Math.min(90, drag.current.startY + ((event.clientY - drag.current.y) / rect.height) * 100)); setTransform(current => ({ ...current, x, y })) }
  function endDrag() { drag.current = null }
  if (isCustomizerPage) return <main className="editor-page"><header><a className="brand" href="/">TINTA<span>•</span>CLUB</a><nav><a href="/">Inicio</a><a className="current-nav" href="/personaliza">Personalizá</a><a href="/#como-funciona">Cómo funciona</a></nav><button className="cart" type="button">Bolsa <span>0</span></button></header><section className="customizer-section standalone" id="personaliza"><div className="customizer-intro"><div><p className="eyebrow">CREÁ TU PRENDA</p><h2>Personalizá tu remera.</h2></div><p>Subí tu diseño, acomodalo y mandanos tu pedido.</p></div><section className="customizer" aria-label="Personalizador de remera"><aside className="controls"><div className="step"><span>01</span><div><h2>Tu diseño</h2><p>PNG, JPG o WEBP · Máx. 10 MB</p></div></div><label className="upload" htmlFor="design-upload"><strong>{design ? 'Cambiar imagen' : 'Subir imagen'}</strong><small>{fileName || 'Elegí el archivo de tu dispositivo'}</small></label><input id="design-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadDesign}/>{design && <button className="remove-image" type="button" onClick={removeDesign}>× Quitar imagen</button>}{notice && <p className={`notice ${notice.startsWith('Atención') ? 'warning' : ''}`}>{notice}</p>}<div className="step separation"><span>02</span><div><h2>Personalizá</h2><p>Ajustá tu prenda</p></div></div><div className="option"><label>Color <b>{color.name}</b></label><div className="swatches">{COLORS.map(item => <button key={item.name} title={item.name} aria-label={item.name} className={color.name === item.name ? 'selected' : ''} onClick={() => setColor(item)} style={{ backgroundColor: item.value }}/>)}</div></div><div className="option"><label>Lado</label><div className="choice">{['Frente', 'Espalda'].map(item => <button key={item} onClick={() => setSide(item)} className={side === item ? 'active' : ''}>{item}</button>)}</div></div><div className="option"><label>Talle</label><div className="sizes">{SIZES.map(item => <button key={item} className={size === item ? 'active' : ''} onClick={() => setSize(item)}>{item}</button>)}</div></div></aside><section className="preview"><div className="preview-top"><span>VISTA {side.toUpperCase()}</span><span className="print-label">ÁREA MÁXIMA 30 × 40 CM</span></div><div className="canvas" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><Shirt color={color} design={design} transform={transform} side={side} onPointerDown={startDrag}/></div><p className="drag-help">{design ? 'Arrastrá el diseño para reposicionarlo' : 'Tu diseño aparecerá en esta zona'}</p></section><aside className="adjustments"><h2>Ajustes del diseño</h2><p className="adjust-copy">Usá los controles para dejarlo perfecto.</p><label className="range-label">Tamaño <output>{transform.scale}%</output></label><input className="range" type="range" min="20" max="90" value={transform.scale} onChange={event => setTransform({ ...transform, scale: event.target.value })}/><label className="range-label">Rotación <output>{transform.rotation}°</output></label><input className="range" type="range" min="-180" max="180" value={transform.rotation} onChange={event => setTransform({ ...transform, rotation: event.target.value })}/><button className="reset" onClick={() => setTransform({ x: 50, y: 43, scale: 54, rotation: 0 })}>↺ Restablecer posición</button><div className="summary"><span>Remera personalizada</span><strong>$ 18.900</strong><small>El precio final puede variar según el diseño.</small></div><a className="order" href={`https://wa.me/5491100000000?text=${whatsappMessage}`} target="_blank" rel="noreferrer">Pedir por WhatsApp <span>→</span></a></aside></section></section></main>
  return <main><header><a className="brand" href="#inicio">TINTA<span>•</span>CLUB</a><nav><a href="#inicio">Inicio</a><a href="#personaliza">Personalizá</a><a href="#como-funciona">Cómo funciona</a></nav><button className="cart" type="button">Bolsa <span>0</span></button></header><section className="landing" id="inicio"><div className="landing-copy"><p className="eyebrow">HECHAS PARA LLEVAR TU IDEA</p><h1>Tu idea.<br/><em>Tu remera.</em></h1><p className="landing-text">Diseñá una prenda que no se parece a ninguna otra. Elegí el color, subí tu arte y nosotros la hacemos realidad.</p><div className="landing-actions"><a className="primary-cta" href="#personaliza">Crear mi remera <span>↘</span></a><a className="text-cta" href="#como-funciona">Cómo funciona <span>↓</span></a></div><div className="home-note"><b>+500</b><span>prendas únicas<br/>impresas con cuidado</span></div></div><div className="hero-photo"><img src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=85" alt="Remeras personalizadas"/><div className="hero-stamp">DISEÑÁ<br/>SIN LÍMITES</div><p>EST. 2026 · BUENOS AIRES</p></div></section><section className="featured"><div className="featured-copy"><p className="eyebrow">HECHO A TU MANERA</p><h2>Una prenda que empieza<br/>con <em>vos.</em></h2><p>Para tu marca, tu banda, tu equipo o simplemente una idea que querés usar.</p></div><div className="photo-tile warm"><img src="https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80" alt="Estilo personal"/><span>EXPRESATE</span></div><div className="photo-tile dark"><img src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80" alt="Remera de algodón"/><span>100% ALGODÓN</span></div></section><section className="customizer-section" id="personaliza"><div className="customizer-intro"><p className="eyebrow">CREÁ TU PRENDA</p><h2>Personalizá tu remera.</h2><p>Subí tu diseño, acomodalo y mandanos tu pedido.</p></div><section className="customizer" aria-label="Personalizador de remera"><aside className="controls"><div className="step"><span>01</span><div><h2>Tu diseño</h2><p>PNG, JPG o WEBP · Máx. 10 MB</p></div></div><label className="upload" htmlFor="design-upload"><strong>{design ? 'Cambiar imagen' : 'Subir imagen'}</strong><small>{fileName || 'Elegí el archivo de tu dispositivo'}</small></label><input id="design-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadDesign}/>{design && <button className="remove-image" type="button" onClick={removeDesign}>× Quitar imagen</button>}{notice && <p className={`notice ${notice.startsWith('Atención') ? 'warning' : ''}`}>{notice}</p>}<div className="step separation"><span>02</span><div><h2>Personalizá</h2><p>Ajustá tu prenda</p></div></div><div className="option"><label>Color <b>{color.name}</b></label><div className="swatches">{COLORS.map(item => <button key={item.name} title={item.name} aria-label={item.name} className={color.name === item.name ? 'selected' : ''} onClick={() => setColor(item)} style={{ backgroundColor: item.value }}/>)}</div></div><div className="option"><label>Lado</label><div className="choice">{['Frente', 'Espalda'].map(item => <button key={item} onClick={() => setSide(item)} className={side === item ? 'active' : ''}>{item}</button>)}</div></div><div className="option"><label>Talle</label><div className="sizes">{SIZES.map(item => <button key={item} className={size === item ? 'active' : ''} onClick={() => setSize(item)}>{item}</button>)}</div></div></aside><section className="preview"><div className="preview-top"><span>VISTA {side.toUpperCase()}</span><span className="print-label">ÁREA MÁXIMA 30 × 40 CM</span></div><div className="canvas" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><Shirt color={color} design={design} transform={transform} side={side} onPointerDown={startDrag}/></div><p className="drag-help">{design ? 'Arrastrá el diseño para reposicionarlo' : 'Tu diseño aparecerá en esta zona'}</p></section><aside className="adjustments"><h2>Ajustes del diseño</h2><p className="adjust-copy">Usá los controles para dejarlo perfecto.</p><label className="range-label">Tamaño <output>{transform.scale}%</output></label><input className="range" type="range" min="20" max="90" value={transform.scale} onChange={event => setTransform({ ...transform, scale: event.target.value })}/><label className="range-label">Rotación <output>{transform.rotation}°</output></label><input className="range" type="range" min="-180" max="180" value={transform.rotation} onChange={event => setTransform({ ...transform, rotation: event.target.value })}/><button className="reset" onClick={() => setTransform({ x: 50, y: 43, scale: 54, rotation: 0 })}>↺ Restablecer posición</button><div className="summary"><span>Remera personalizada</span><strong>$ 18.900</strong><small>El precio final puede variar según el diseño.</small></div><a className="order" href={`https://wa.me/5491100000000?text=${whatsappMessage}`} target="_blank" rel="noreferrer">Pedir por WhatsApp <span>→</span></a></aside></section></section><section className="how" id="como-funciona"><p className="eyebrow">ASÍ DE SIMPLE</p><h2>Diseñá, pedí, estrená.</h2><div><p><b>01</b> Subí tu imagen</p><p><b>02</b> Acomodala a tu gusto</p><p><b>03</b> Confirmá tu pedido</p></div></section></main>
}
export default App
