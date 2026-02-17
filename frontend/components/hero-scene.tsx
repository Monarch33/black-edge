"use client"
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

function Particles() {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const p = new Float32Array(1500 * 3)
    for (let i = 0; i < 1500; i++) {
      p[i * 3]     = (Math.random() - 0.5) * 20
      p[i * 3 + 1] = (Math.random() - 0.5) * 20
      p[i * 3 + 2] = (Math.random() - 0.5) * 15
    }
    return p
  }, [])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.02
      ref.current.rotation.x = clock.elapsedTime * 0.008
    }
  })

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.04}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  )
}

function Network() {
  const ref = useRef<THREE.LineSegments>(null)
  const geo = useMemo(() => {
    const n = 40
    const pos = new Float32Array(n * 3)
    const idx: number[] = []
    for (let i = 0; i < n; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 12
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(
          pos[i*3] - pos[j*3],
          pos[i*3+1] - pos[j*3+1],
          pos[i*3+2] - pos[j*3+2]
        )
        if (d < 4) idx.push(i, j)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1))
    return g
  }, [])

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.012
  })

  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.05} />
    </lineSegments>
  )
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 60 }}
      style={{ background: 'transparent' }}
      dpr={[1, 1.5]}
    >
      <Particles />
      <Network />
    </Canvas>
  )
}
