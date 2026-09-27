import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// Constant horizontal spacing between consecutive topics matching user reference screenshot
export const TOPIC_SPACING_X = 2.15;
export const TOPIC_START_X = 0;

// 1. Smoothly Scrolling Roadmap Container Group
export function SmoothScrollRoadmap({
  scrollX,
  zoomScale,
  resetTrigger = 0,
  children
}: {
  scrollX: number;
  zoomScale: number;
  resetTrigger?: number;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const currentXRef = useRef(0);

  // Instantly snap to 0 on reset without lag
  useEffect(() => {
    currentXRef.current = scrollX;
    if (groupRef.current) {
      groupRef.current.position.x = -scrollX;
    }
  }, [resetTrigger]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      // Responsive, zero-delay smooth interpolation (settles cleanly in ~50ms without drag/lag)
      const factor = 1 - Math.exp(-32.0 * Math.min(delta, 0.05));
      currentXRef.current += (scrollX - currentXRef.current) * factor;
      if (Math.abs(scrollX - currentXRef.current) < 0.0005) {
        currentXRef.current = scrollX;
      }
      groupRef.current.position.x = -currentXRef.current;
    }
  });

  return (
    <group ref={groupRef} scale={zoomScale}>
      {children}
    </group>
  );
}

// 2. Scene Controls with OrbitControls 3D rotation, dynamic viewport positioning, and Reset Trigger
export function SceneControls({
  resetTrigger = 0,
  zoomScale = 1.0,
  topicCount = 0,
  onMaxScrollChange
}: {
  resetTrigger?: number;
  zoomScale?: number;
  topicCount?: number;
  onMaxScrollChange?: (max: number) => void;
}) {
  const spotlightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const targetPosRef = useRef(new THREE.Vector3());
  const controlsRef = useRef<any>(null);
  const { camera, viewport } = useThree();

  const CAMERA_Z = 7.8;
  const CAMERA_Y = 0.05;

  const maxScrollRef = useRef(-1);

  // Exact visible width along plane z = 0 based on vertical FOV and canvas aspect ratio
  const getVisibleWidth = () => {
    const fovRad = (((camera as THREE.PerspectiveCamera).fov || 44) * Math.PI) / 360;
    const visibleHeight = 2 * Math.tan(fovRad) * CAMERA_Z;
    return visibleHeight * (viewport.width / (viewport.height || 1));
  };

  // Position camera at startCameraX (aligns first topic at far left edge)
  useEffect(() => {
    const visibleWidth = getVisibleWidth();
    const startCamX = (visibleWidth / 2) - 1.45;
    console.log('SceneControls mount/resize:', { visibleWidth, startCamX, camX: camera.position.x, vpW: viewport.width, vpH: viewport.height });
    camera.position.set(startCamX, CAMERA_Y, CAMERA_Z);
    camera.rotation.set(0, 0, 0);
    camera.quaternion.identity();
    camera.zoom = 1;
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(startCamX, CAMERA_Y, 0);
      controlsRef.current.saveState();
      controlsRef.current.update();
    }
  }, [viewport.width, viewport.height]);

  // Reset trigger restores camera orientation, position, and controls target to far left
  useEffect(() => {
    if (resetTrigger > 0) {
      const visibleWidth = getVisibleWidth();
      const startCamX = (visibleWidth / 2) - 1.45;
      camera.position.set(startCamX, CAMERA_Y, CAMERA_Z);
      camera.rotation.set(0, 0, 0);
      camera.quaternion.identity();
      camera.zoom = 1;
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.set(startCamX, CAMERA_Y, 0);
        controlsRef.current.saveState();
        controlsRef.current.update();
      }
    }
  }, [resetTrigger]);

  useFrame(() => {
    const visibleWidth = getVisibleWidth();
    const lastTopicX = Math.max(0, topicCount - 1) * TOPIC_SPACING_X * zoomScale;
    const rightMargin = 3.5 * zoomScale;
    const currentMaxScroll = Math.max(0, lastTopicX - visibleWidth + 1.45 + rightMargin);

    if (Math.abs(currentMaxScroll - maxScrollRef.current) > 0.02) {
      maxScrollRef.current = currentMaxScroll;
      if (onMaxScrollChange) {
        onMaxScrollChange(currentMaxScroll);
      }
    }

    if (spotlightRef.current) {
      spotlightRef.current.position.copy(camera.position);

      targetPosRef.current.set(camera.position.x, CAMERA_Y, -10);
      targetPosRef.current.applyQuaternion(camera.quaternion);
      targetPosRef.current.add(camera.position);

      targetRef.current.position.copy(targetPosRef.current);
      spotlightRef.current.target = targetRef.current;
    }
  });

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={true}
        rotateSpeed={0.5}
        enableDamping={true}
        dampingFactor={0.08}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2 - 0.35}
        maxPolarAngle={Math.PI / 2 + 0.35}
        minAzimuthAngle={-0.45}
        maxAzimuthAngle={0.45}
      />
      <primitive object={targetRef.current} />
      <spotLight
        ref={spotlightRef}
        intensity={3.5}
        distance={40}
        angle={Math.PI / 4}
        penumbra={1}
        decay={2}
        color="#cbe3cf"
      />
    </>
  );
}

// 2. High-Tech Neural Data Network Layout Generator - Matches exact wave and spacing in reference screenshot
export function calculateTopicPositions(topics: any[]): [number, number, number][] {
  const n = topics?.length || 0;
  if (n === 0) return [];

  return topics.map((_, i) => {
    const x = TOPIC_START_X + i * TOPIC_SPACING_X;
    // Alternating wave with gentle upward tilt matching reference screenshot peaks and troughs
    const y = (i % 2 === 0 ? -0.18 : 0.22) + i * 0.035;
    const z = 0;
    return [x, y, z];
  });
}

// 3. Animated Flowing Data Packets along the Fiber-Optic Spline
function FlowingDataPulses({ curve, nodeCount }: { curve: THREE.CatmullRomCurve3; nodeCount: number }) {
  const count = Math.max(6, Math.min(24, Math.round(nodeCount * 1.5)));
  const pulseRefs = useRef<THREE.Mesh[]>([]);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta * 0.18;
    const t = timeRef.current;

    pulseRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const progress = (t + i / count) % 1;
      const pt = curve.getPoint(progress);
      mesh.position.copy(pt);
      const scale = 0.85 + Math.sin(progress * Math.PI) * 0.45;
      mesh.scale.set(scale, scale, scale);
    });
  });

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) pulseRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#52b788" : "#2d6a4f"}
            emissive={i % 2 === 0 ? "#74c69d" : "#235035"}
            emissiveIntensity={2.2}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

// 4. Subtle Ambient Sage & Forest Particles
function SubtleSageDust({ totalWidth }: { totalWidth: number }) {
  const count = Math.max(40, Math.min(100, Math.round(totalWidth * 2.2)));
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sage = new THREE.Color("#52b788");
    const forest = new THREE.Color("#2d6a4f");

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.15) * (totalWidth + 10) + TOPIC_START_X;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 0.5;

      const chosenColor = Math.random() > 0.4 ? sage : forest;
      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }

    return [pos, col];
  }, [count, totalWidth]);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.01;
      pointsRef.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.32}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// 5. Curved Sage & Forest Light Paths Matching Website Theme
export const RoadmapPath = React.memo(function RoadmapPath({ points }: { points: [number, number, number][] }) {
  const sequentialCurve = useMemo(() => {
    if (!points || points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const extendedVectors = [
      new THREE.Vector3(first[0] - 2.0, first[1] - 0.15, first[2]),
      ...points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      new THREE.Vector3(last[0] + 2.0, last[1] + 0.15, last[2])
    ];
    return new THREE.CatmullRomCurve3(extendedVectors, false, 'centripetal', 0.25);
  }, [points]);

  const totalWidth = (points.length - 1) * TOPIC_SPACING_X;

  return (
    <group>
      {/* Ambient Subtle Sage Dust */}
      <SubtleSageDust totalWidth={totalWidth} />

      {/* Main Flowing Fiber-Optic Cable (Sage and Forest Green) */}
      {sequentialCurve && (
        <>
          {/* Outer glowing sage halo tube - Matches reference screenshot */}
          <mesh>
            <tubeGeometry args={[sequentialCurve, Math.max(points.length * 36, 120), 0.075, 8, false]} />
            <meshStandardMaterial
              color="#52b788"
              emissive="#2d6a4f"
              emissiveIntensity={0.5}
              transparent
              opacity={0.35}
              roughness={0.4}
            />
          </mesh>

          {/* Inner core rich forest conduit */}
          <mesh>
            <tubeGeometry args={[sequentialCurve, Math.max(points.length * 36, 120), 0.038, 8, false]} />
            <meshStandardMaterial
              color="#163824"
              emissive="#245436"
              emissiveIntensity={1.2}
              roughness={0.25}
            />
          </mesh>

          {/* Animated Flowing Light Pearls */}
          <FlowingDataPulses curve={sequentialCurve} nodeCount={points.length} />
        </>
      )}
    </group>
  );
});

// 6. Neural Network Topic Node (Matches user reference screenshot EXACTLY)
export const TopicNode = React.memo(function TopicNode({
  position,
  title,
  completed,
  isSelected = false,
  zoomScale = 1.0,
  onClick
}: {
  position: [number, number, number];
  title: string;
  completed: boolean;
  isSelected?: boolean;
  progress?: number;
  zoomScale?: number;
  onClick: () => void;
}) {
  const timeRef = useRef(0);
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Elegant Cream & Sage harmonious palette
  const coreColor = completed
    ? "#2d8653" // Radiant deep mint/emerald for completed
    : isSelected
    ? "#163824" // Signature forest green for selected
    : hovered
    ? "#275936"
    : "#2d6a4f"; // Polished sage-jade for standard

  const accentColor = completed ? "#52b788" : isSelected ? "#74c69d" : "#52b788";
  const glowMultiplier = completed ? 2.2 : isSelected ? 2.6 : hovered ? 2.0 : 1.4;

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    // Smooth quantum core rotation
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.55;
      coreRef.current.rotation.y += delta * 0.75;

      // Pulse animation
      const pulse = Math.sin(t * (completed ? 2.5 : 1.8)) * 0.05;
      const baseScale = isSelected ? 1.15 + pulse : 1.0 + pulse;
      const targetScale = hovered ? baseScale * 1.12 : baseScale;
      const currentScale = THREE.MathUtils.lerp(coreRef.current.scale.x, targetScale, 0.12);
      coreRef.current.scale.set(currentScale, currentScale, currentScale);
    }

    // Holographic Gimbal Ring 1
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.5;
      ring1Ref.current.rotation.z -= delta * 0.35;
    }

    // Holographic Gimbal Ring 2 (tilted)
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 0.45;
      ring2Ref.current.rotation.x -= delta * 0.35;
    }

    // Pulsing Beacon Aura
    if (auraRef.current) {
      const auraScale = 1.0 + Math.sin(t * 1.8) * 0.05;
      auraRef.current.scale.set(auraScale, auraScale, auraScale);
    }
  });

  return (
    <group
      position={position}
      onClick={onClick}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Dynamic Point Light on Node */}
      {(isSelected || hovered || completed) && (
        <pointLight
          color={accentColor}
          intensity={isSelected ? 2.0 : 1.4}
          distance={3.5}
        />
      )}

      {/* Gimbal Ring 1 */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[0.95, 0.022, 16, 64]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={glowMultiplier * 1.1}
          roughness={0.25}
          metalness={0.65}
        />
      </mesh>

      {/* Gimbal Ring 2 (tilted) */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 4, 0, Math.PI / 6]}>
        <torusGeometry args={[1.12, 0.018, 16, 64]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={glowMultiplier}
          roughness={0.25}
          metalness={0.65}
        />
      </mesh>

      {/* Mid Circular Ring facing camera */}
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[0.82, 0.88, 64]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={completed ? 0.45 : isSelected ? 0.55 : 0.32}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Large Glowing Outer Circular Ring - Overlaps slightly with adjacent node rings matching screenshot */}
      <mesh ref={auraRef} rotation={[0, 0, 0]}>
        <ringGeometry args={[1.25, 1.32, 64]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={completed ? 0.45 : isSelected ? 0.55 : 0.30}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Futuristic Faceted Quantum Core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.60, 0]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={glowMultiplier * 0.9}
          wireframe={!completed && !isSelected}
          roughness={0.25}
          metalness={0.6}
        />
      </mesh>

      {/* Inner Energy Kernel */}
      <mesh>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshBasicMaterial
          color={completed ? "#ffffff" : accentColor}
        />
      </mesh>

      {/* Topic Card matching reference screenshot: compact width, original font size, natural multi-line wrapping */}
      <Html
        center
        position={[0, -1.38, 0]}
        style={{
          userSelect: 'none'
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="rounded-2xl transition-all border text-center cursor-pointer shadow-sm px-2.5 py-3"
          style={{
            width: '104px',
            minWidth: '98px',
            maxWidth: '112px',
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
            backgroundColor: isSelected
              ? '#163824'
              : completed
              ? '#eef7f0'
              : hovered
              ? '#f4f8f4'
              : 'rgba(255, 255, 255, 0.98)',
            borderColor: isSelected
              ? '#163824'
              : completed
              ? '#9fd3ab'
              : hovered
              ? '#163824'
              : '#d2ded2',
            color: isSelected ? '#ffffff' : '#163824',
            boxShadow: isSelected
              ? '0 6px 20px rgba(22, 56, 36, 0.28), 0 0 0 2.5px #cbe3cf'
              : '0 4px 14px rgba(22, 56, 36, 0.08)',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 900,
              letterSpacing: '0.04em',
              lineHeight: 1.25,
              display: 'block',
              textTransform: 'uppercase',
              wordBreak: 'break-word',
              hyphens: 'manual'
            }}
          >
            {title}
          </span>
        </div>
      </Html>
    </group>
  );
});

// 7. Legacy export for compatibility
export function FloatingDashboard() {
  return null;
}

export default function ThreeDashboard() {
  return null;
}
