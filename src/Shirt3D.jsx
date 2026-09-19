import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

function PrintedDesign({ url, transform }) {
  const texture = useTexture(url)
  texture.colorSpace = THREE.SRGBColorSpace
  const aspect = texture.image?.width && texture.image?.height ? texture.image.width / texture.image.height : 1
  const width = 0.75 * (Number(transform.scale) / 54)
  const height = width / aspect
  const position = [
    ((Number(transform.x) - 50) / 100) * 1.05,
    ((50 - Number(transform.y)) / 100) * 1.25,
    0.63,
  ]
  return (
    <mesh position={position} rotation={[0, 0, -THREE.MathUtils.degToRad(Number(transform.rotation))]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

function Model({ color, design, side, transform, viewScale }) {
  const { scene } = useGLTF('/models/customer-tshirt.glb')
  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    model.traverse((object) => {
      if (!object.isMesh) return
      object.material = object.material.clone()
      object.material.color.set(color.value)
    })
  }, [color, model])

  return (
    <group rotation={[0, side === 'Espalda' ? Math.PI : 0, 0]} position={[0, -0.08, 0]} scale={2.2 * viewScale}>
      <primitive object={model} />
      {design && <PrintedDesign url={design} transform={transform} />}
    </group>
  )
}

function Shirt3D({ color, design, side, transform }) {
  const [viewScale, setViewScale] = useState(1)
  const zoomOut = () => setViewScale((current) => Math.max(0.75, Number((current - 0.1).toFixed(2))))
  const zoomIn = () => setViewScale((current) => Math.min(1.25, Number((current + 0.1).toFixed(2))))

  return (
    <div className="shirt-3d" aria-label={`Modelo 3D de remera ${color.name}, vista ${side}`}>
      <Canvas camera={{ position: [0, 0.15, 5.4], fov: 26 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[-4, 5, 6]} intensity={2.4} />
        <directionalLight position={[4, 2, 3]} intensity={1.1} />
        <Suspense fallback={null}>
          <Model color={color} design={design} side={side} transform={transform} viewScale={viewScale} />
          <ContactShadows position={[0, -0.1, 0]} opacity={0.28} scale={7} blur={2.5} far={4} />
        </Suspense>
      </Canvas>
      <div className="view-zoom" aria-label="Tamaño de la vista de la remera">
        <button type="button" onClick={zoomOut} disabled={viewScale <= 0.75} aria-label="Alejar remera">−</button>
        <span>{Math.round(viewScale * 100)}%</span>
        <button type="button" onClick={zoomIn} disabled={viewScale >= 1.25} aria-label="Acercar remera">+</button>
      </div>
    </div>
  )
}

useGLTF.preload('/models/customer-tshirt.glb')

export default Shirt3D
