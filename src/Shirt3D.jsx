import { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

function PrintedDesign({ url, transform }) {
  const texture = useTexture(url)
  texture.colorSpace = THREE.SRGBColorSpace
  const aspect = texture.image?.width && texture.image?.height ? texture.image.width / texture.image.height : 1
  const width = 1.25 * (Number(transform.scale) / 54)
  const height = width / aspect
  const position = [
    ((Number(transform.x) - 50) / 100) * 1.18,
    1.72 + ((43 - Number(transform.y)) / 100) * 1.55,
    0.218,
  ]
  return (
    <mesh position={position} rotation={[0, 0, -THREE.MathUtils.degToRad(Number(transform.rotation))]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

function Model({ color, design, side, transform }) {
  const { scene } = useGLTF('/models/tinta-club-tshirt.glb')
  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    model.traverse((object) => {
      if (!object.isMesh) return
      object.material = object.material.clone()
      if (object.name.includes('T-Shirt') || object.name.includes('Sleeve') || object.name.includes('Torus')) object.material.color.set(color.value)
    })
  }, [color, model])

  return <group rotation={[0, side === 'Espalda' ? Math.PI : 0, 0]} position={[0, -1.66, 0]} scale={0.9}>{<primitive object={model} />}{design && <PrintedDesign url={design} transform={transform} />}</group>
}

function Shirt3D({ color, design, side, transform }) {
  return (
    <div className="shirt-3d" aria-label={`Modelo 3D de remera ${color.name}, vista ${side}`}>
      <Canvas camera={{ position: [0, 1.85, 8], fov: 26 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[-4, 5, 6]} intensity={2.4} />
        <directionalLight position={[4, 2, 3]} intensity={1.1} />
        <Suspense fallback={null}>
          <Model color={color} design={design} side={side} transform={transform} />
          <ContactShadows position={[0, -0.1, 0]} opacity={0.28} scale={7} blur={2.5} far={4} />
        </Suspense>
        <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 2.2} maxPolarAngle={Math.PI / 1.8} />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/tinta-club-tshirt.glb')

export default Shirt3D
