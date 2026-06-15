"use client";

import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import {
  getAllDealers, getDealersByMolecularRegion, getDealerById,
  MOLECULAR_REGIONS, MOLECULAR_REGION_LABELS, MOLECULAR_REGION_COLORS,
  type MolecularRegion, type Dealer,
} from '@/lib/dealers';

type Theme = 'dark' | 'light';

// ===== Layout — mirrors the real molecular filter's spherical Fibonacci distribution =====
// Real system uses RING_RADII = [0, 8, 14, 20, 27, 34] with Fibonacci sphere placement.
// We adopt the same scaffolding so the dealership filter has the same depth/density feel.

const RING_RADII = [0, 8, 14, 20, 27, 34];

const NUCLEUS_RADIUS = 2.5;
const REGION_ATOM_RADIUS = 1.4;
const DEALER_ATOM_RADIUS = 0.22;

const REGION_RING = 1;   // 6 region atoms on Fibonacci sphere of radius 8
const DEALER_RING = 4;   // 890 dealer atoms on Fibonacci sphere of radius 27 (density-equivalent to campaigns)

const NUCLEUS_COLOR = '#1B4DA0'; // Ford brand blue

// ===== Fibonacci sphere distribution (same algorithm as molecular-graph.ts) =====
function fibonacciSphere(numPoints: number, radius: number): [number, number, number][] {
  if (numPoints === 1) return [[0, 0, 0]];
  const points: [number, number, number][] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < numPoints; i++) {
    const y = 1 - (i / (numPoints - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push([
      radius * radiusAtY * Math.cos(theta),
      radius * y * 0.7, // oblate spheroid (matches real molecular scene)
      radius * radiusAtY * Math.sin(theta),
    ]);
  }
  return points;
}

/** Region anchor positions — Fibonacci sphere on Ring 1 (radius 8) */
function computeRegionPositions(): Map<MolecularRegion, [number, number, number]> {
  const map = new Map<MolecularRegion, [number, number, number]>();
  const positions = fibonacciSphere(MOLECULAR_REGIONS.length, RING_RADII[REGION_RING]);
  MOLECULAR_REGIONS.forEach((region, i) => map.set(region, positions[i]));
  return map;
}

/** Dealer positions — distributed on Ring 4 (radius 27) but ordered so each region's dealers cluster
 *  on a hemisphere of the sphere centered on the region's anchor direction.
 *  This keeps the rich 3D molecule feel while preserving region color clustering. */
function computeDealerPositions(regionPositions: Map<MolecularRegion, [number, number, number]>): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();
  const byRegion = getDealersByMolecularRegion();
  const dealerRadius = RING_RADII[DEALER_RING];

  // For each region, generate a Fibonacci sphere of dealers, then rotate so the cluster centers on the region's anchor direction.
  MOLECULAR_REGIONS.forEach((region) => {
    const dealers = byRegion[region];
    const regionAnchor = regionPositions.get(region)!;
    const regionDir = new THREE.Vector3(...regionAnchor).normalize();

    // Generate dealers on the FRONT HEMISPHERE of a unit sphere (y >= 0), then rotate so +Y points toward region anchor.
    const hemispherePoints: THREE.Vector3[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const n = dealers.length;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / Math.max(1, n - 1)) * 1.0;  // hemisphere: y from 1 to 0
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      hemispherePoints.push(new THREE.Vector3(
        radiusAtY * Math.cos(theta),
        y * 0.7,
        radiusAtY * Math.sin(theta),
      ).normalize());
    }

    // Build a rotation matrix that maps +Y to regionDir
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, regionDir);

    dealers.forEach((dealer, i) => {
      const p = hemispherePoints[i].clone().applyQuaternion(quat).multiplyScalar(dealerRadius);
      positions.set(dealer.id, [p.x, p.y, p.z]);
    });
  });

  return positions;
}

// ===== Region atom (interactive, larger) =====
interface RegionAtomProps {
  region: MolecularRegion;
  basePosition: [number, number, number];
  isSelected: boolean;
  isHovered: boolean;
  hasSelection: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  theme: Theme;
}

function RegionAtom({ region, basePosition, isSelected, isHovered, hasSelection, onSelect, onHover, theme }: RegionAtomProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(MOLECULAR_REGION_COLORS[region]), [region]);

  const targetScale = isSelected ? 1.18 : isHovered ? 1.12 : (hasSelection ? 0.85 : 1.0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const s = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(s + (targetScale - s) * 0.1);

    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = isSelected ? 0.85 + Math.sin(t * 3) * 0.15 : isHovered ? 0.7 : 0.4;
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = isSelected ? 1.1 : isHovered ? 0.85 : 0.55;
    }
  });

  const regionId = `region-${region}`;

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(regionId);
  }, [regionId, onSelect]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(regionId);
    document.body.style.cursor = 'pointer';
  }, [regionId, onHover]);

  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  return (
    <group ref={groupRef} position={basePosition}>
      <mesh ref={outerRef} onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <sphereGeometry args={[REGION_ATOM_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.45}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.4}
          metalness={0.15}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[REGION_ATOM_RADIUS * 0.32, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={1.0}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[REGION_ATOM_RADIUS * 1.18, REGION_ATOM_RADIUS * 1.30, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Billboard>
        <Text
          position={[0, -(REGION_ATOM_RADIUS + 0.6), 0]}
          fontSize={0.65}
          color={theme === 'light' ? '#0a1a16' : '#ffffff'}
          anchorX="center"
          anchorY="top"
          fillOpacity={isSelected || isHovered ? 1.0 : 0.85}
        >
          {MOLECULAR_REGION_LABELS[region]}
        </Text>
      </Billboard>
    </group>
  );
}

// ===== Nucleus (LONGO'S) =====
function Nucleus({ theme }: { theme: Theme }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(NUCLEUS_COLOR), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(t * 1.2) * 0.1;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={outerRef}>
        <sphereGeometry args={[NUCLEUS_RADIUS, 40, 40]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.42}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.35}
          metalness={0.2}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[NUCLEUS_RADIUS * 0.35, 32, 32]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={1.0}
          emissive={color}
          emissiveIntensity={0.7}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
      <Billboard>
        <Text
          position={[0, -(NUCLEUS_RADIUS + 0.9), 0]}
          fontSize={1.1}
          color={theme === 'light' ? '#0a1a16' : '#ffffff'}
          anchorX="center"
          anchorY="top"
          fillOpacity={0.95}
          letterSpacing={0.18}
        >
          LONGO&apos;S
        </Text>
      </Billboard>
    </group>
  );
}

// ===== Dealer Cloud — 890 dealers as InstancedMesh =====
interface DealerCloudProps {
  dealers: Dealer[];
  positions: Map<string, [number, number, number]>;
  selectedDealerId: string | null;
  hoveredDealerId: string | null;
  onSelectDealer: (id: string) => void;
  onHoverDealer: (id: string | null) => void;
}

function DealerCloud({ dealers, positions, selectedDealerId, hoveredDealerId, onSelectDealer, onHoverDealer }: DealerCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = dealers.length;

  // Build instance matrices + colors once
  const { matrices, colors, regionByIndex } = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const colorArr: number[] = [];
    const regionByIdx: MolecularRegion[] = [];
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    for (const dealer of dealers) {
      const pos = positions.get(dealer.id) ?? [0, 0, 0];
      dummy.position.set(...pos);
      dummy.scale.setScalar(DEALER_ATOM_RADIUS);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      // Color by region — find the molecular region for this dealer
      const molecularRegion = inferMolecularRegion(dealer);
      tmpColor.set(MOLECULAR_REGION_COLORS[molecularRegion]);
      colorArr.push(tmpColor.r, tmpColor.g, tmpColor.b);
      regionByIdx.push(molecularRegion);
    }

    return {
      matrices: mats,
      colors: new Float32Array(colorArr),
      regionByIndex: regionByIdx,
    };
  }, [dealers, positions]);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const tmpColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      // setColorAt initializes mesh.instanceColor on first call and writes the per-instance color
      tmpColor.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      mesh.setColorAt(i, tmpColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, matrices, colors]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined || e.instanceId === null) return;
    const dealer = dealers[e.instanceId];
    if (dealer) onSelectDealer(dealer.id);
  }, [dealers, onSelectDealer]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined || e.instanceId === null) return;
    const dealer = dealers[e.instanceId];
    if (dealer && dealer.id !== hoveredDealerId) {
      onHoverDealer(dealer.id);
      document.body.style.cursor = 'pointer';
    }
  }, [dealers, hoveredDealerId, onHoverDealer]);

  const handlePointerOut = useCallback(() => {
    onHoverDealer(null);
    document.body.style.cursor = 'auto';
  }, [onHoverDealer]);

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial transparent opacity={0.95} toneMapped={false} />
      </instancedMesh>

      {/* Highlight halo for hovered/selected dealer */}
      {(hoveredDealerId || selectedDealerId) && (
        <DealerHighlight
          dealer={dealers.find((d) => d.id === (selectedDealerId ?? hoveredDealerId))!}
          position={positions.get(selectedDealerId ?? hoveredDealerId!) ?? [0, 0, 0]}
        />
      )}
    </>
  );
}

function DealerHighlight({ dealer, position }: { dealer: Dealer; position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const region = inferMolecularRegion(dealer);
  const color = useMemo(() => new THREE.Color(MOLECULAR_REGION_COLORS[region]), [region]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1.0 + Math.sin(t * 4) * 0.2;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[DEALER_ATOM_RADIUS * 3.5, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  );
}

// ===== Helpers =====
function inferMolecularRegion(dealer: Dealer): MolecularRegion {
  // Dealer IDs encode their region — `dealer-${region}-${idx}`
  const match = dealer.id.match(/^dealer-([a-z]+)-/);
  if (match) return match[1] as MolecularRegion;
  return dealer.region as MolecularRegion;
}

// ===== Bonds — nucleus to regions, regions to dealers (via single LineSegments per region) =====
function Bonds({
  regionPositions, dealerPositions, dealersByRegion, selectedRegionIds, hoveredRegionId,
}: {
  regionPositions: Map<MolecularRegion, [number, number, number]>;
  dealerPositions: Map<string, [number, number, number]>;
  dealersByRegion: Record<MolecularRegion, Dealer[]>;
  selectedRegionIds: Set<string>;
  hoveredRegionId: string | null;
}) {
  // Combined LineSegments per-region for the dealer connections (1 draw call per region = 6 total)
  const regionDealerGeometries = useMemo(() => {
    const map = new Map<MolecularRegion, THREE.BufferGeometry>();
    for (const region of MOLECULAR_REGIONS) {
      const regionPos = regionPositions.get(region);
      if (!regionPos) continue;
      const dealers = dealersByRegion[region];
      const positions: number[] = [];
      for (const dealer of dealers) {
        const dPos = dealerPositions.get(dealer.id);
        if (!dPos) continue;
        positions.push(regionPos[0], regionPos[1], regionPos[2], dPos[0], dPos[1], dPos[2]);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      map.set(region, geom);
    }
    return map;
  }, [regionPositions, dealerPositions, dealersByRegion]);

  return (
    <>
      {/* Nucleus → regions (6 highlighted bonds) */}
      {MOLECULAR_REGIONS.map((region) => {
        const target = regionPositions.get(region);
        if (!target) return null;
        const regionId = `region-${region}`;
        const isLit = hoveredRegionId === regionId || selectedRegionIds.has(regionId);
        return (
          <Line
            key={`nuc-${region}`}
            points={[[0, 0, 0], target]}
            color={MOLECULAR_REGION_COLORS[region]}
            lineWidth={isLit ? 2.4 : 1.2}
            opacity={isLit ? 0.85 : 0.4}
            transparent
          />
        );
      })}

      {/* Regions → dealers (6 batched line segments) */}
      {MOLECULAR_REGIONS.map((region) => {
        const geom = regionDealerGeometries.get(region);
        if (!geom) return null;
        const regionId = `region-${region}`;
        const isLit = hoveredRegionId === regionId || selectedRegionIds.has(regionId);
        return (
          <lineSegments key={`reg-${region}`} geometry={geom}>
            <lineBasicMaterial
              color={MOLECULAR_REGION_COLORS[region]}
              transparent
              opacity={isLit ? 0.45 : 0.12}
            />
          </lineSegments>
        );
      })}
    </>
  );
}

// ===== Ring Guides — wireframe spheres at every RING_RADII level (matches real molecular scene) =====
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

// ===== Scene Content =====
interface SceneContentProps {
  selectedIds: Set<string>;
  selectedDealerId: string | null;
  hoveredId: string | null;
  hoveredDealerId: string | null;
  onSelect: (id: string) => void;
  onSelectDealer: (id: string) => void;
  onHover: (id: string | null) => void;
  onHoverDealer: (id: string | null) => void;
  theme: Theme;
}

function SceneContent({
  selectedIds, selectedDealerId, hoveredId, hoveredDealerId,
  onSelect, onSelectDealer, onHover, onHoverDealer, theme,
}: SceneContentProps) {
  const dealers = useMemo(() => getAllDealers(), []);
  const dealersByRegion = useMemo(() => getDealersByMolecularRegion(), []);
  const regionPositions = useMemo(() => computeRegionPositions(), []);
  const dealerPositions = useMemo(() => computeDealerPositions(regionPositions), [regionPositions]);

  const ambient = theme === 'light' ? 0.85 : 0.6;
  const keyLight = theme === 'light' ? 0.9 : 1.3;
  const fillLight = theme === 'light' ? 0.3 : 0.55;
  const hasSelection = selectedIds.size > 0;

  return (
    <>
      <ambientLight intensity={ambient} />
      <pointLight position={[25, 30, 25]} intensity={keyLight} />
      <pointLight position={[-20, -15, 20]} intensity={fillLight} color="#5DCAA5" />
      <pointLight position={[0, 0, 0]} intensity={0.4} color={NUCLEUS_COLOR} distance={20} />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={80}
        enablePan={false}
      />

      {/* Wireframe ring guides — same 5 spheres as the real molecular filter for visual depth */}
      <RingGuides theme={theme} />

      <Bonds
        regionPositions={regionPositions}
        dealerPositions={dealerPositions}
        dealersByRegion={dealersByRegion}
        selectedRegionIds={selectedIds}
        hoveredRegionId={hoveredId}
      />

      <Nucleus theme={theme} />

      {MOLECULAR_REGIONS.map((region) => {
        const regionId = `region-${region}`;
        return (
          <RegionAtom
            key={region}
            region={region}
            basePosition={regionPositions.get(region)!}
            isSelected={selectedIds.has(regionId)}
            isHovered={hoveredId === regionId}
            hasSelection={hasSelection}
            onSelect={onSelect}
            onHover={onHover}
            theme={theme}
          />
        );
      })}

      <DealerCloud
        dealers={dealers}
        positions={dealerPositions}
        selectedDealerId={selectedDealerId}
        hoveredDealerId={hoveredDealerId}
        onSelectDealer={onSelectDealer}
        onHoverDealer={onHoverDealer}
      />
    </>
  );
}

// ===== Main exported component =====
interface DealershipMolecularSceneProps {
  selectedIds: Set<string>;
  selectedDealerId: string | null;
  onSelect: (id: string) => void;
  onSelectDealer: (id: string) => void;
  hoveredId: string | null;
  hoveredDealerId: string | null;
  onHover: (id: string | null) => void;
  onHoverDealer: (id: string | null) => void;
  theme: Theme;
}

export function DealershipMolecularScene({
  selectedIds, selectedDealerId,
  onSelect, onSelectDealer,
  hoveredId, hoveredDealerId,
  onHover, onHoverDealer,
  theme,
}: DealershipMolecularSceneProps) {
  const hoveredDealer = hoveredDealerId ? getDealerById(hoveredDealerId) : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 15, 65], fov: 50, near: 0.1, far: 250 }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <SceneContent
          selectedIds={selectedIds}
          selectedDealerId={selectedDealerId}
          hoveredId={hoveredId}
          hoveredDealerId={hoveredDealerId}
          onSelect={onSelect}
          onSelectDealer={onSelectDealer}
          onHover={onHover}
          onHoverDealer={onHoverDealer}
          theme={theme}
        />
      </Canvas>

      {/* Hovered dealer tooltip — bottom-center, matches existing molecular pattern */}
      {hoveredDealer && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg bg-card-elevated/90 backdrop-blur border border-border/30 pointer-events-none">
          <p className="text-sm font-semibold text-foreground">{hoveredDealer.name}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span>{hoveredDealer.city}</span>
            <span>·</span>
            <span className="capitalize">{hoveredDealer.type.replace('-', ' ')}</span>
            <span>·</span>
            <span className="capitalize">{hoveredDealer.complianceStatus.replace('-', ' ')}</span>
            <span>·</span>
            <span>${(hoveredDealer.monthlySpend / 1000).toFixed(1)}K/mo</span>
          </div>
        </div>
      )}
    </div>
  );
}
