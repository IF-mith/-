import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { SaturnParticles } from './SaturnParticles';

interface ExperienceProps {
  expansionLevel: number; // 0 to 1
}

export const Experience: React.FC<ExperienceProps> = ({ expansionLevel }) => {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Canvas
        camera={{ position: [0, 2, 16], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#050505']} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <SaturnParticles expansion={expansionLevel} />
        
        <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            minDistance={5} 
            maxDistance={25}
            autoRotate={expansionLevel < 0.2} // Auto rotate when formatted as Saturn
            autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};