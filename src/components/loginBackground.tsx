import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const nodes = [
    [-4, 1.8, 0],
    [-2, -1.2, 0.5],
    [-1, 2.2, -0.5],
    [1.2, 0.8, 0],
    [3.5, 2, -0.5],
    [4, -1.5, 0.5],
    [1.5, -2, -0.5],
    [-3.5, -2, 0],
] as const;

const connections = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [2, 4],
    [3, 4],
    [3, 5],
    [3, 6],
    [1, 6],
    [1, 7],
    [6, 5],
    [4, 5],
] as const;

function FloatingNode({
    position,
    index,
}: {
    position: readonly [number, number, number];
    index: number;
}) {
    const mesh = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!mesh.current) return;

        const t = clock.elapsedTime + index * 1.3;

        mesh.current.position.y =
            position[1] + Math.sin(t * 0.6) * 0.18;

        mesh.current.rotation.x = t * 0.15;
        mesh.current.rotation.y = t * 0.2;
    });

    return (
        <mesh
            ref={mesh}
            position={[...position]}
            scale={index % 3 === 0 ? 0.48 : 0.32}
        >
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
                color={index % 2 === 0 ? '#a9c9b1' : '#cbe3cf'}
                roughness={0.45}
                metalness={0.05}
                transparent
                opacity={0.8}
                flatShading
            />
        </mesh>
    );
}

function NetworkLines() {
    const geometry = useMemo(() => {
        const points: THREE.Vector3[] = [];

        connections.forEach(([a, b]) => {
            const start = new THREE.Vector3(...nodes[a]);
            const end = new THREE.Vector3(...nodes[b]);

            const middle = start.clone().add(end).multiplyScalar(0.5);
            middle.z += 0.5;

            const curve = new THREE.QuadraticBezierCurve3(
                start,
                middle,
                end
            );

            points.push(...curve.getPoints(30));
        });

        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);

    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial
                color="#a9c9b1"
                transparent
                opacity={0.35}
            />
        </lineSegments>
    );
}

function FloatingParticles() {
    const points = useRef<THREE.Points>(null);

    const particlePositions = useMemo(() => {
        const positions = new Float32Array(180 * 3);

        for (let i = 0; i < 180; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 12;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
        }

        return positions;
    }, []);

    useFrame(({ clock }) => {
        if (points.current) {
            points.current.rotation.y = clock.elapsedTime * 0.015;
            points.current.rotation.z =
                Math.sin(clock.elapsedTime * 0.1) * 0.025;
        }
    });

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[particlePositions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                color="#a9c9b1"
                size={0.035}
                transparent
                opacity={0.7}
                sizeAttenuation
            />
        </points>
    );
}

function AnimatedNetwork() {
    const group = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (!group.current) return;

        group.current.rotation.y =
            Math.sin(clock.elapsedTime * 0.12) * 0.04;

        group.current.rotation.x =
            Math.sin(clock.elapsedTime * 0.1) * 0.025;
    });

    return (
        <group ref={group}>
            <NetworkLines />

            {nodes.map((position, index) => (
                <FloatingNode
                    key={index}
                    position={position}
                    index={index}
                />
            ))}

            <FloatingParticles />
        </group>
    );
}

export default function LoginBackground() {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <Canvas
                camera={{ position: [0, 0, 11], fov: 50 }}
                dpr={[1, 1.5]}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={1.5} />
                <directionalLight
                    position={[4, 5, 6]}
                    intensity={1.2}
                    color="#ffffff"
                />
                <pointLight
                    position={[-4, 2, 3]}
                    intensity={1}
                    color="#cbe3cf"
                />

                <AnimatedNetwork />
            </Canvas>
        </div>
    );
}