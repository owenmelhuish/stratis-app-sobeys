"use client";

import React, { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Line, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  getBrandGraph, getBrandBasePosition, traceBrandLineage, bondKey,
  BRAND_RING_RADII, NUCLEUS_COLOR, type BrandNode,
} from '@/lib/brand-graph';
import { type EnterpriseId } from '@/types';
import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light';

// ===== Animated node position: Fibonacci base + gentle per-node drift =====
function nodePosition(node: BrandNode, time: number): [number, number, number] {
  if (node.ring === 0) return [0, 0, 0]; // nucleus stays at origin
  const [bx, by, bz] = getBrandBasePosition(node.id);
  const drift = node.ring === 1 ? 0.45 : 0.6;
  return [
    bx + Math.sin(time * 0.3 + node.angle * 0.05) * drift,
    by + Math.sin(time * 0.4 + node.angle * 0.03) * drift,
    bz + Math.cos(time * 0.35 + node.angle * 0.04) * drift,
  ];
}

// ===== Brand / Campaign Atom =====
interface AtomProps {
  node: BrandNode;
  isCurrentBrand: boolean;
  isLit: boolean;
  isHovered: boolean;
  hasHover: boolean;
  labelEnabled: boolean;
  theme: Theme;
  onPick: (node: BrandNode) => void;
  onHover: (node: BrandNode | null) => void;
}

function Atom({ node, isCurrentBrand, isLit, isHovered, hasHover, labelEnabled, theme, onPick, onHover }: AtomProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => new THREE.Color(node.color), [node.color]);
  const vizRadius = node.vizRadius;
  const isBrand = node.kind === 'brand';

  // Dim atoms that aren't part of the hovered lineage
  const dim = hasHover && !isLit && !isHovered;
  const targetScale = isHovered ? 1.28 : isCurrentBrand ? 1.12 : dim ? 0.68 : 1.0;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const [x, y, z] = nodePosition(node, t);
    groupRef.current.position.set(x, y, z);

    const s = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(s + (targetScale - s) * 0.1);

    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = dim ? 0.12 : isHovered ? 0.5 : isBrand ? 0.45 : 0.4;
      mat.opacity += (targetOp - mat.opacity) * 0.1;
      mat.emissiveIntensity = isHovered ? 0.85 + Math.sin(t * 3) * 0.18
        : isCurrentBrand ? 0.6 : isLit ? 0.55 : dim ? 0.18 : 0.34;
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = dim ? 0.35 : 1.0;
      mat.opacity += (targetOp - mat.opacity) * 0.1;
      mat.emissiveIntensity = isHovered ? 1.1 : isCurrentBrand ? 0.8 : isLit ? 0.65 : 0.45;
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onPick(node);
  }, [node, onPick]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(node);
    document.body.style.cursor = 'pointer';
  }, [node, onHover]);

  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  // Labels are filtered by the left-side panel, but hovering or being part of a
  // highlighted lineage always reveals the title so you can read what you aim at.
  const showLabel = labelEnabled || isHovered || isLit;
  const labelOpacity = isHovered ? 1.0
    : isLit ? 0.96
    : dim ? (isBrand ? 0.34 : 0.2)
    : isBrand ? 0.88 : 0.62;

  return (
    <group ref={groupRef}>
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
          opacity={0.45}
          emissive={color}
          emissiveIntensity={0.34}
          roughness={0.4}
          metalness={0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[vizRadius * 0.32, 16, 16]} />
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
      {(isCurrentBrand || isHovered) && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[vizRadius * 1.18, vizRadius * 1.32, 48]} />
          <meshBasicMaterial color={color} transparent opacity={isHovered ? 0.7 : 0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      {showLabel && (
        <Billboard>
          <Text
            position={[0, -(vizRadius + (isBrand ? 0.7 : 0.42)), 0]}
            fontSize={isBrand ? 0.72 : 0.4}
            color={theme === 'light' ? '#0a1a16' : '#ffffff'}
            anchorX="center"
            anchorY="top"
            fillOpacity={labelOpacity}
            outlineWidth={isBrand ? 0.014 : 0.008}
            outlineColor={theme === 'light' ? '#ffffff' : '#000000'}
            renderOrder={isBrand ? 2 : 1}
          >
            {node.shortLabel}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ===== Nucleus (STRATIS) =====
function Nucleus({ theme }: { theme: Theme }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(NUCLEUS_COLOR), []);
  const vizRadius = 2.5;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(t * 1.2) * 0.12;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={outerRef}>
        <sphereGeometry args={[vizRadius, 40, 40]} />
        <meshStandardMaterial
          color={color} transparent opacity={0.42} emissive={color}
          emissiveIntensity={0.5} roughness={0.35} metalness={0.2} depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[vizRadius * 0.35, 32, 32]} />
        <meshStandardMaterial
          color={color} transparent opacity={1.0} emissive={color}
          emissiveIntensity={0.7} roughness={0.2} metalness={0.4}
        />
      </mesh>
      <Html
        position={[0, -(vizRadius + 1.2), 0]}
        center transform sprite distanceFactor={6}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <img
          src="/stratis-logo.svg" alt="STRATIS" width={260} height={35} draggable={false}
          style={{ display: 'block', filter: theme === 'light' ? 'none' : 'invert(1)', opacity: 0.95 }}
        />
      </Html>
    </group>
  );
}

// ===== Bonds (faint always; lineage brightens on hover) =====
function Bonds({ litBonds, hasHover, time }: { litBonds: Set<string>; hasHover: boolean; time: number }) {
  const { nodes, bonds, nodeMap } = getBrandGraph();

  const positions = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    for (const n of nodes) map.set(n.id, nodePosition(n, time));
    return map;
  }, [nodes, time]);

  return (
    <>
      {bonds.map((bond, i) => {
        const from = positions.get(bond.source);
        const to = positions.get(bond.target);
        if (!from || !to) return null;
        const lit = litBonds.has(bondKey(bond.source, bond.target));
        // Hide most resting bonds when hovering to spotlight the lineage
        if (hasHover && !lit) return null;
        const child = nodeMap.get(bond.target);
        const color = child?.color ?? '#6B7280';
        return (
          <Line
            key={i}
            points={[from, to]}
            color={lit ? color : '#6B7280'}
            lineWidth={lit ? 2.4 : 0.8}
            opacity={lit ? 0.75 : 0.12}
            transparent
          />
        );
      })}
    </>
  );
}

function BondsAnimated({ litBonds, hasHover }: { litBonds: Set<string>; hasHover: boolean }) {
  const [frameTime, setFrameTime] = useState(0);
  useFrame(({ clock }) => {
    if (Math.floor(clock.getElapsedTime() * 20) !== Math.floor(frameTime * 20)) {
      setFrameTime(clock.getElapsedTime());
    }
  });
  return <Bonds litBonds={litBonds} hasHover={hasHover} time={frameTime} />;
}

// ===== Ring guides (wireframe spheres) =====
function RingGuides({ theme }: { theme: Theme }) {
  const color = theme === 'light' ? '#0a1a16' : '#ffffff';
  const opacity = theme === 'light' ? 0.08 : 0.06;
  return (
    <>
      {BRAND_RING_RADII.slice(1).map((radius, i) => (
        <mesh key={i}>
          <sphereGeometry args={[radius, 24, 16]} />
          <meshBasicMaterial wireframe transparent opacity={opacity} color={color} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// ===== Scene Content =====
interface SceneContentProps {
  currentEnterprise: EnterpriseId | null;
  hoveredId: string | null;
  labelFilter: (node: BrandNode) => boolean;
  onHover: (node: BrandNode | null) => void;
  onPick: (node: BrandNode) => void;
  theme: Theme;
}

function SceneContent({ currentEnterprise, hoveredId, labelFilter, onHover, onPick, theme }: SceneContentProps) {
  const { nodes } = getBrandGraph();
  const { litNodes, litBonds } = useMemo(() => traceBrandLineage(hoveredId), [hoveredId]);
  const hasHover = hoveredId !== null;

  const ambient = theme === 'light' ? 0.85 : 0.6;
  const keyLight = theme === 'light' ? 0.9 : 1.3;
  const fillLight = theme === 'light' ? 0.3 : 0.55;

  return (
    <>
      <ambientLight intensity={ambient} />
      <pointLight position={[25, 30, 25]} intensity={keyLight} />
      <pointLight position={[-20, -15, 20]} intensity={fillLight} color="#5DCAA5" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color={NUCLEUS_COLOR} distance={22} />

      <OrbitControls
        autoRotate autoRotateSpeed={0.3}
        enableDamping dampingFactor={0.05}
        minDistance={16} maxDistance={70} enablePan={false}
      />

      <RingGuides theme={theme} />
      <Nucleus theme={theme} />

      {nodes.map((node) =>
        node.kind === 'nucleus' ? null : (
          <Atom
            key={node.id}
            node={node}
            isCurrentBrand={node.kind === 'brand' && node.enterpriseId === currentEnterprise}
            isLit={litNodes.has(node.id)}
            isHovered={hoveredId === node.id}
            hasHover={hasHover}
            labelEnabled={labelFilter(node)}
            theme={theme}
            onPick={onPick}
            onHover={onHover}
          />
        ),
      )}

      <BondsAnimated litBonds={litBonds} hasHover={hasHover} />
    </>
  );
}

// ===== Main Component =====
interface EnterpriseMolecularSceneProps {
  currentEnterprise: EnterpriseId | null;
  onSelectBrand: (id: EnterpriseId) => void;
  onSelectCampaign: (id: EnterpriseId, campaignId: string) => void;
  labelFilter?: (node: BrandNode) => boolean;
  theme?: Theme;
}

export function EnterpriseMolecularScene({
  currentEnterprise,
  onSelectBrand,
  onSelectCampaign,
  labelFilter,
  theme = 'dark',
}: EnterpriseMolecularSceneProps) {
  const [hovered, setHovered] = useState<BrandNode | null>(null);

  const handlePick = useCallback((node: BrandNode) => {
    if (node.kind === 'brand' && node.enterpriseId) {
      onSelectBrand(node.enterpriseId);
    } else if (node.kind === 'campaign' && node.enterpriseId && node.campaignId) {
      onSelectCampaign(node.enterpriseId, node.campaignId);
    }
  }, [onSelectBrand, onSelectCampaign]);

  const accent = hovered?.color ?? '#FF7A1A';

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 12, 46], fov: 50, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <SceneContent
          currentEnterprise={currentEnterprise}
          hoveredId={hovered?.id ?? null}
          labelFilter={labelFilter ?? (() => true)}
          onHover={setHovered}
          onPick={handlePick}
          theme={theme}
        />
      </Canvas>

      {/* Hover tooltip — bottom-center */}
      <div className="absolute bottom-10 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <div
          className={cn(
            'px-5 py-3 rounded-xl border bg-card-elevated/90 backdrop-blur-md transition-all duration-200 min-w-[260px] text-center',
            hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
          style={{ borderColor: hovered ? `${accent}66` : 'transparent' }}
        >
          {hovered && hovered.kind === 'brand' && (
            <>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: accent }}>
                {currentEnterprise === hovered.enterpriseId ? `Current Client · ${hovered.sublabel}` : `Client · ${hovered.sublabel}`}
              </p>
              <p className="text-sm font-bold text-foreground mt-1">{hovered.label}</p>
              <p className="text-[11px] font-medium text-muted-foreground">Click to enter brand instance</p>
            </>
          )}
          {hovered && hovered.kind === 'campaign' && (
            <>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: accent }}>
                Campaign · {hovered.sublabel}
              </p>
              <p className="text-sm font-bold text-foreground mt-1 max-w-[300px] truncate mx-auto">{hovered.label}</p>
              <p className="text-[11px] font-medium text-muted-foreground">Click to open this campaign</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
