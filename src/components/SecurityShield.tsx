import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface ShieldCoreProps {
  isScanning: boolean;
  threatLevel: 'safe' | 'suspicious' | 'malicious' | 'idle';
}

const ShieldMesh = ({ isScanning, threatLevel }: ShieldCoreProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    switch (threatLevel) {
      case 'safe': return '#00ff88';
      case 'suspicious': return '#ff8800';
      case 'malicious': return '#ff2244';
      default: return '#00f0ff';
    }
  }, [threatLevel]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 0.3;
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
      ringRef.current.rotation.x = Math.sin(t * 0.3) * 0.3;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.4;
      ring2Ref.current.rotation.y = Math.cos(t * 0.2) * 0.3;
    }
  });

  const distortSpeed = isScanning ? 4 : 1.5;
  const distortStrength = isScanning ? 0.4 : 0.2;

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <group>
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[1.5, 4]} />
          <MeshDistortMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isScanning ? 0.8 : 0.3}
            roughness={0.1}
            metalness={0.9}
            distort={distortStrength}
            speed={distortSpeed}
            wireframe
          />
        </mesh>

        <mesh ref={ringRef}>
          <torusGeometry args={[2.2, 0.02, 16, 64]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.6} />
        </mesh>

        <mesh ref={ring2Ref}>
          <torusGeometry args={[2.6, 0.015, 16, 64]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.4} />
        </mesh>

        <pointLight color={color} intensity={2} distance={8} />
      </group>
    </Float>
  );
};

const SecurityShield = ({ isScanning, threatLevel }: ShieldCoreProps) => {
  return (
    <div className="w-full h-[400px] md:h-[500px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <ShieldMesh isScanning={isScanning} threatLevel={threatLevel} />
      </Canvas>
    </div>
  );
};

export default SecurityShield;
