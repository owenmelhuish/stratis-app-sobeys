"use client";

import React, { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import {
  MOLECULAR_NODES, MOLECULAR_BONDS, RING_RADII, RING_NODE_RADII,
  traceLineage, getBasePosition, type MolecularNode,
} from '@/lib/molecular-graph';

// Get animated node position from precomputed Fibonacci sphere base + gentle drift
function nodePosition(node: MolecularNode, time: number): [number, number, number] {
  const [bx, by, bz] = getBasePosition(node.id);
  if (node.ring === 0) return [0, 0, 0]; // Sobeys nucleus stays at origin
  const drift = 0.4;
  return [
    bx + Math.sin(time * 0.3 + node.angle * 0.05) * drift,
    by + Math.sin(time * 0.4 + node.angle * 0.03) * drift,
    bz + Math.cos(time * 0.35 + node.angle * 0.04) * drift,
  ];
}

function bondKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

type Theme = 'dark' | 'light';

// ===== Atom (Node) Component =====
interface AtomProps {
  node: MolecularNode;
  isSelected: boolean;
  isLit: boolean;
  hasSelection: boolean;
  theme: Theme;
  onSelect: (id: string) => void;
  onHover: (node: MolecularNode | null) => void;
}

function Atom({ node, isSelected, isLit, hasSelection, theme, onSelect, onHover }: AtomProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => new THREE.Color(node.color), [node.color]);
  const vizRadius = RING_NODE_RADII[node.ring] ?? 0.6;

  const targetScale = isSelected ? 1.2 : hovered ? 1.1 : (hasSelection && !isLit) ? 0.8 : 1.0;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const [x, y, z] = nodePosition(node, t);
    groupRef.current.position.set(x, y, z);

    // Smooth scale
    const s = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(s + (targetScale - s) * 0.08);

    // Outer sphere opacity
    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = (hasSelection && !isLit && !isSelected) ? 0.15 : isSelected ? 0.5 : 0.4;
      mat.opacity += (targetOp - mat.opacity) * 0.08;
      mat.emissiveIntensity = isSelected ? 0.9 + Math.sin(t * 3) * 0.2 : hovered ? 0.65 : isLit ? 0.5 : 0.3;
    }

    // Core opacity
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = (hasSelection && !isLit && !isSelected) ? 0.4 : 1.0;
      mat.opacity += (targetOp - mat.opacity) * 0.08;
      mat.emissiveIntensity = isSelected ? 1.1 : hovered ? 0.8 : isLit ? 0.6 : 0.45;
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(node.id);
  }, [node.id, onSelect]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    onHover(node);
    document.body.style.cursor = 'pointer';
  }, [node, onHover]);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    onHover(null);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  const labelOpacity = (hasSelection && !isLit && !isSelected) ? 0.35 : isSelected ? 1.0 : isLit ? 0.9 : 0.75;

  return (
    <group ref={groupRef}>
      {/* Outer semi-transparent sphere */}
      <mesh
        ref={outerRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[vizRadius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.4}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>
      {/* Bright inner core (30% of radius) */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[vizRadius * 0.3, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={1.0}
          emissive={color}
          emissiveIntensity={0.45}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[vizRadius * 1.1, vizRadius * 1.2, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Label below sphere */}
      <Billboard>
        <Text
          position={[0, -(vizRadius + 0.6), 0]}
          fontSize={node.ring === 0 ? 1.2 : node.ring <= 2 ? 0.65 : 0.5}
          color={theme === 'light' ? '#0a1a16' : '#ffffff'}
          anchorX="center"
          anchorY="top"
          fillOpacity={labelOpacity}
        >
          {node.label}
        </Text>
      </Billboard>
    </group>
  );
}

// ===== Bonds Component =====
interface BondsProps {
  selectedIds: Set<string>;
  time: number;
}

function Bonds({ selectedIds, time }: BondsProps) {
  const { litBonds } = useMemo(
    () => traceLineage(selectedIds),
    [selectedIds],
  );
  const hasSelection = selectedIds.size > 0;

  const positions = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    for (const node of MOLECULAR_NODES) {
      map.set(node.id, nodePosition(node, time));
    }
    return map;
  }, [time]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, MolecularNode>();
    for (const n of MOLECULAR_NODES) m.set(n.id, n);
    return m;
  }, []);

  // No selection = no bonds. Selection = only lineage bonds.
  if (!hasSelection) return null;

  return (
    <>
      {MOLECULAR_BONDS.map((bond, i) => {
        const bk = bondKey(bond.source, bond.target);
        if (!litBonds.has(bk)) return null;

        const from = positions.get(bond.source);
        const to = positions.get(bond.target);
        if (!from || !to) return null;

        const outerNode = nodeMap.get(bond.target);
        const litColor = outerNode?.color ?? '#ffffff';

        return (
          <Line
            key={i}
            points={[from, to]}
            color={litColor}
            lineWidth={2.5}
            opacity={0.65}
            transparent
          />
        );
      })}
    </>
  );
}

// ===== Ring Guides (wireframe spheres) =====
function RingGuides({ theme }: { theme: Theme }) {
  const color = theme === 'light' ? '#0a1a16' : '#ffffff';
  const opacity = theme === 'light' ? 0.08 : 0.06;
  return (
    <>
      {RING_RADII.slice(1).map((radius, i) => (
        <mesh key={i}>
          <sphereGeometry args={[radius, 24, 16]} />
          <meshBasicMaterial
            wireframe
            transparent
            opacity={opacity}
            color={color}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ===== Scene Content (inside Canvas) =====
interface SceneContentProps {
  selectedIds: Set<string>;
  theme: Theme;
  onSelect: (id: string) => void;
  onHover: (node: MolecularNode | null) => void;
}

function SceneContent({ selectedIds, theme, onSelect, onHover }: SceneContentProps) {
  const { litNodes } = useMemo(
    () => traceLineage(selectedIds),
    [selectedIds],
  );
  const hasSelection = selectedIds.size > 0;

  // Light mode: lower ambient + softer point lights so glowing atoms don't blow out on white.
  // Dark mode: keep brighter values so nodes glow against the near-black backdrop.
  const ambient = theme === 'light' ? 0.85 : 0.6;
  const keyLight = theme === 'light' ? 0.9 : 1.2;
  const fillLight = theme === 'light' ? 0.3 : 0.5;

  return (
    <>
      <ambientLight intensity={ambient} />
      <pointLight position={[25, 30, 25]} intensity={keyLight} />
      <pointLight position={[-20, -15, 20]} intensity={fillLight} color="#5DCAA5" />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={80}
        enablePan={false}
      />

      <RingGuides theme={theme} />

      {MOLECULAR_NODES.map((node) => (
        <Atom
          key={node.id}
          node={node}
          isSelected={selectedIds.has(node.id)}
          isLit={litNodes.has(node.id)}
          hasSelection={hasSelection}
          theme={theme}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}

      <BondsAnimated selectedIds={selectedIds} />
    </>
  );
}

// Animated bonds — throttled position updates for perf
function BondsAnimated({ selectedIds }: { selectedIds: Set<string> }) {
  const [frameTime, setFrameTime] = useState(0);
  useFrame(({ clock }) => {
    if (Math.floor(clock.getElapsedTime() * 20) !== Math.floor(frameTime * 20)) {
      setFrameTime(clock.getElapsedTime());
    }
  });

  return <Bonds selectedIds={selectedIds} time={frameTime} />;
}

// ===== Main Exported Component =====
interface MolecularSceneProps {
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  hoveredNode: MolecularNode | null;
  onHover: (node: MolecularNode | null) => void;
  theme: Theme;
}

export function MolecularScene({ selectedIds, onSelect, hoveredNode, onHover, theme }: MolecularSceneProps) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 15, 50], fov: 50, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <SceneContent
          selectedIds={selectedIds}
          theme={theme}
          onSelect={onSelect}
          onHover={onHover}
        />
      </Canvas>
      {hoveredNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-card-elevated/90 backdrop-blur border border-border/30 pointer-events-none">
          <p className="text-xs font-medium text-foreground">{hoveredNode.label}</p>
          <p className="text-[10px] text-muted-foreground">{hoveredNode.description}</p>
        </div>
      )}
    </div>
  );
}
