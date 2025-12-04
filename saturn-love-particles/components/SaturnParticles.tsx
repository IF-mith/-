import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_COUNT, RING_PARTICLE_COUNT, HEART_PARTICLE_COUNT } from '../constants';

// Vertex Shader: Interpolates between a "Saturn" state and an "Exploded" state
const vertexShader = `
  uniform float uTime;
  uniform float uExpansion; // 0.0 (Saturn) -> 1.0 (Exploded)
  uniform float uPixelRatio;

  attribute vec3 aSaturnPos;
  attribute vec3 aRandomPos;
  attribute float aSize;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;

  // Noise function for subtle movement
  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vColor = aColor;
    
    // Base position mixes between structured Saturn and random Chaos
    vec3 targetPos = mix(aSaturnPos, aRandomPos, uExpansion);
    
    // Add some drift based on time
    float drift = sin(uTime * 0.5 + aRandomPos.x * 10.0) * 0.1 * uExpansion;
    targetPos.y += drift;

    vec4 mvPosition = modelViewMatrix * vec4(targetPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation
    gl_PointSize = aSize * uPixelRatio * (1.0 + uExpansion * 0.5);
    gl_PointSize *= (20.0 / -mvPosition.z);
    
    // Fade out slightly when exploded to look ethereal
    vAlpha = 1.0 - (uExpansion * 0.3); 
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Circular particle
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;

    // Soft edge glow
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

// Heart Particles Shader (Simpler)
const heartVertexShader = `
  uniform float uTime;
  uniform float uExpansion; 
  uniform float uPixelRatio;

  attribute vec3 aPos;
  attribute float aScale;
  
  varying float vOpacity;

  void main() {
    // Only show when expanded
    float activation = smoothstep(0.7, 1.0, uExpansion);
    
    vec3 pos = aPos;
    // Float upwards
    pos.y += uTime * 0.5 * aScale; 
    // Loop y
    pos.y = mod(pos.y + 5.0, 10.0) - 5.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = aScale * 30.0 * uPixelRatio;
    gl_PointSize *= (10.0 / -mvPosition.z);
    
    vOpacity = activation;
  }
`;

const heartFragmentShader = `
  varying float vOpacity;

  void main() {
    if (vOpacity < 0.01) discard;

    vec2 uv = gl_PointCoord;
    // Simple Heart SDF
    uv = uv * 2.0 - 1.0;
    uv.y -= 0.25;
    float r = length(uv);
    float a = atan(uv.x, uv.y) / 3.141593;
    float h = abs(a);
    float d = (13.0*h - 22.0*h*h + 10.0*h*h*h)/(6.0-5.0*h);
    
    if (r > d) discard;

    gl_FragColor = vec4(1.0, 0.4, 0.6, vOpacity);
  }
`;

interface SaturnParticlesProps {
  expansion: number;
}

export const SaturnParticles: React.FC<SaturnParticlesProps> = ({ expansion }) => {
  const meshRef = useRef<THREE.Points>(null);
  const heartsRef = useRef<THREE.Points>(null);

  // Generate Geometry Data
  const { positions, randomPositions, colors, sizes } = useMemo(() => {
    const pos = [];
    const randPos = [];
    const cols = [];
    const sz = [];

    // Silver/Gray Theme
    const saturnBaseColor = new THREE.Color("#A0A0A0"); // Metallic Silver
    const ringBaseColor = new THREE.Color("#FFFFFF");   // Bright White/Silver for Rings

    // 1. Sphere (Body)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Uniform sphere point
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      // Reduced planet radius for better proportion
      const r = 2.8;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      pos.push(x, y, z);
      
      // Explosion target: Move outward significantly
      const exDir = new THREE.Vector3(x, y, z).normalize().multiplyScalar(5 + Math.random() * 10);
      randPos.push(exDir.x, exDir.y, exDir.z);

      // Slight color variation for depth
      const variance = (Math.random() - 0.5) * 0.2;
      cols.push(
          Math.min(1, saturnBaseColor.r + variance), 
          Math.min(1, saturnBaseColor.g + variance), 
          Math.min(1, saturnBaseColor.b + variance)
      );
      sz.push(Math.random() * 2 + 1.0);
    }

    // 2. Rings
    for (let i = 0; i < RING_PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      
      // Adjusted Rings: Start at 3.6 (clear gap from 2.8 planet) and extend to ~7.6
      const r = 3.6 + Math.random() * 4.0;
      
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      const y = (Math.random() - 0.5) * 0.15; // Thinner disk for sharpness

      pos.push(x, y, z);
      
      // Explosion target
      const exDir = new THREE.Vector3(x, y, z).normalize().multiplyScalar(5 + Math.random() * 15);
      // Add random chaotic verticality to rings when exploded
      exDir.y += (Math.random() - 0.5) * 10.0;
      randPos.push(exDir.x, exDir.y, exDir.z);

      // Bright sparkly rings
      const brightness = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
      cols.push(ringBaseColor.r * brightness, ringBaseColor.g * brightness, ringBaseColor.b * brightness);
      
      // Some particles larger for "sparkle" effect
      sz.push(Math.random() > 0.9 ? Math.random() * 3 + 1 : Math.random() * 1.5 + 0.5);
    }

    return {
      positions: new Float32Array(pos),
      randomPositions: new Float32Array(randPos),
      colors: new Float32Array(cols),
      sizes: new Float32Array(sz)
    };
  }, []);

  const heartData = useMemo(() => {
    const pos = [];
    const scale = [];
    for(let i=0; i<HEART_PARTICLE_COUNT; i++) {
        const x = (Math.random() - 0.5) * 15;
        const y = (Math.random() - 0.5) * 10;
        const z = (Math.random() - 0.5) * 10;
        pos.push(x,y,z);
        scale.push(Math.random() * 0.5 + 0.5);
    }
    return {
        positions: new Float32Array(pos),
        scales: new Float32Array(scale)
    }
  }, []);

  useFrame((state) => {
    const { clock } = state;
    if (meshRef.current) {
        // @ts-ignore
        meshRef.current.material.uniforms.uTime.value = clock.elapsedTime;
        // @ts-ignore
        meshRef.current.material.uniforms.uExpansion.value = expansion;
    }
    if (heartsRef.current) {
        // @ts-ignore
        heartsRef.current.material.uniforms.uTime.value = clock.elapsedTime;
         // @ts-ignore
        heartsRef.current.material.uniforms.uExpansion.value = expansion;
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExpansion: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
  }), []);

  return (
    <>
      {/* Main Saturn System */}
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-aSaturnPos" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-aRandomPos" count={randomPositions.length / 3} array={randomPositions} itemSize={3} />
          <bufferAttribute attach="attributes-aColor" count={colors.length / 3} array={colors} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" count={sizes.length} array={sizes} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Heart Particles (Only visible when expanded) */}
      <points ref={heartsRef}>
         <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={heartData.positions.length / 3} array={heartData.positions} itemSize={3} />
            <bufferAttribute attach="attributes-aPos" count={heartData.positions.length / 3} array={heartData.positions} itemSize={3} />
            <bufferAttribute attach="attributes-aScale" count={heartData.scales.length} array={heartData.scales} itemSize={1} />
         </bufferGeometry>
         <shaderMaterial 
            vertexShader={heartVertexShader}
            fragmentShader={heartFragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
         />
      </points>
    </>
  );
};