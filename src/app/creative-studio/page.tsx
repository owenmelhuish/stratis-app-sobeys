"use client";

import React, { useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MousePointer2,
  RotateCcw,
  MessageSquare,
  Crop,
  Play,
  ChevronDown,
  Undo2,
  Redo2,
  Camera,
  Sun,
  Lightbulb,
  LayoutGrid,
  Box,
  Image,
  Type,
  Layers,
  Lock,
  Eye,
  Star,
  Search,
  Command,
  Plus,
  Sparkles,
  Mic,
  ArrowUp,
  Video,
  FileText,
  Clock,
  Minus,
} from "lucide-react";

// ─── Layer data ─────────────────────────────────────────────────────────────

interface SceneLayer {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  locked: boolean;
}

const INITIAL_LAYERS: SceneLayer[] = [
  { id: "cam1", name: "Camera 1", icon: Camera, visible: true, locked: false },
  { id: "dome", name: "Dome Light", icon: Sun, visible: true, locked: false },
  { id: "key", name: "Key Light", icon: Lightbulb, visible: true, locked: false },
  { id: "area", name: "Area Light", icon: LayoutGrid, visible: true, locked: false },
  { id: "lightning", name: "Hero Product Shot", icon: Box, visible: true, locked: true },
  { id: "ford-oval", name: "Sobeys Logo", icon: Box, visible: true, locked: true },
  { id: "paint", name: "Price Burst", icon: Layers, visible: true, locked: false },
  { id: "headline", name: "Headline Text", icon: Type, visible: true, locked: false },
  { id: "bg", name: "Background", icon: Image, visible: true, locked: false },
];

// ─── Layer category mapping ─────────────────────────────────────────────────

type LayerCategory = "lighting" | "product" | "effects" | "copy" | "background";

const LAYER_CATEGORIES: Record<string, LayerCategory> = {
  cam1: "lighting",
  dome: "lighting",
  key: "lighting",
  area: "lighting",
  avion: "product",
  shield: "product",
  paint: "effects",
  headline: "copy",
  bg: "background",
};

// ─── Toolbar icons ──────────────────────────────────────────────────────────

const TOOLBAR_TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "rotate", icon: RotateCcw, label: "Rotate" },
  { id: "comment", icon: MessageSquare, label: "Comment" },
  { id: "crop", icon: Crop, label: "Crop" },
  { id: "play", icon: Play, label: "Preview" },
];

const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CreativeStudioPage() {
  // Left panel
  const [leftTab, setLeftTab] = useState<"scene" | "assets">("scene");
  const [selectedLayer, setSelectedLayer] = useState("headline");
  const [layers, setLayers] = useState(INITIAL_LAYERS);

  // Toolbar
  const [activeTool, setActiveTool] = useState("select");
  const [zoom, setZoom] = useState(50);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Right panel
  const [rightTab, setRightTab] = useState<"design" | "animation">("design");
  const [bgColor, setBgColor] = useState("D4A0A0");
  const [bgOpacity, setBgOpacity] = useState(100);
  const [selectedBgPreset, setSelectedBgPreset] = useState("rose");
  const [selectedProductAngle, setSelectedProductAngle] = useState("3-quarter");
  const [selectedProductColor, setSelectedProductColor] = useState("white");
  const [headlineText, setHeadlineText] = useState("FRESH NEVER\nTASTED LIKE SAVINGS.");
  const [selectedFont, setSelectedFont] = useState("Impact");
  const [fontSize, setFontSize] = useState(72);
  const [effectIntensity, setEffectIntensity] = useState(80);
  const [selectedEffectStyle, setSelectedEffectStyle] = useState("drip");
  const [lightIntensity, setLightIntensity] = useState(75);
  const [lightTemp, setLightTemp] = useState(55);

  // Variant expansion animation
  const [variantsExpanded, setVariantsExpanded] = useState(false);

  // Canvas navigation
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Bottom bar
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<HTMLInputElement>(null);

  // Layer actions
  const toggleLayerVisibility = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };
  const toggleLayerLock = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
    );
  };

  const cycleZoom = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    setZoom(ZOOM_LEVELS[(idx + 1) % ZOOM_LEVELS.length]);
  };

  // ─── Canvas navigation ────────────────────────────────────────────────────

  const clampZoom = (z: number) => Math.min(300, Math.max(25, z));

  // Wheel: ctrl/meta+scroll = zoom, otherwise pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((prev) => clampZoom(Math.round(prev - e.deltaY * 0.5)));
    } else {
      setPanOffset((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  }, []);

  // Left-click drag to pan
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // left button only
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panOffset]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleCanvasPointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Double-click to reset view
  const handleCanvasDoubleClick = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(100);
  }, []);

  return (
    <div className="-m-8 flex flex-col h-[calc(100vh-57px)] bg-background overflow-hidden">
      {/* ═══ Top Toolbar ═══ */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-card shrink-0">
        {/* Left — project info */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border/30 flex items-center justify-center">
            <Box className="h-4 w-4 text-teal" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold">Scene+ Summer Launch</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground">Ad Campaign Project</p>
          </div>
        </div>

        {/* Center — tools */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-1 border border-border/20">
            {TOOLBAR_TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                title={tool.label}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  activeTool === tool.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                <tool.icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-border/30 mx-2" />

          {/* Zoom */}
          <div className="relative">
            <button
              onClick={() => setZoomOpen(!zoomOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              {zoom}%
              <ChevronDown className="h-3 w-3" />
            </button>
            {zoomOpen && (
              <div className="absolute top-full mt-1 left-0 bg-card border border-border/40 rounded-lg shadow-xl py-1 z-50 min-w-[80px]">
                {ZOOM_LEVELS.map((z) => (
                  <button
                    key={z}
                    onClick={() => { setZoom(z); setZoomOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs transition-colors",
                      z === zoom ? "text-teal bg-teal/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {z}%
                  </button>
                ))}
                <div className="border-t border-border/20 mt-1 pt-1">
                  <button
                    onClick={() => { setZoom(100); setPanOffset({ x: 0, y: 0 }); setZoomOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    Reset View
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-border/30 mx-2" />

          {/* Undo / redo */}
          <button className="p-2 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Undo2 className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-3 min-w-[200px] justify-end">
          <Badge className="bg-teal/15 text-teal border-0 text-[10px] font-semibold">Coming Soon</Badge>
          <div className="flex -space-x-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal to-emerald-400 border-2 border-card" />
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange to-amber-400 border-2 border-card" />
          </div>
          <button className="px-4 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* ═══ Main Area ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Left Panel ─── */}
        <div className="w-[220px] shrink-0 border-r border-border/30 bg-card flex flex-col">
          {/* Tabs */}
          <div className="flex p-3 gap-1">
            <button
              onClick={() => setLeftTab("scene")}
              className={cn(
                "flex-1 text-xs font-medium py-2 rounded-lg transition-colors",
                leftTab === "scene" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Scene
            </button>
            <button
              onClick={() => setLeftTab("assets")}
              className={cn(
                "flex-1 text-xs font-medium py-2 rounded-lg transition-colors",
                leftTab === "assets" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Assets
            </button>
          </div>

          {/* Layer list */}
          <div className="flex-1 overflow-auto px-2 space-y-0.5">
            {leftTab === "scene" ? (
              layers.map((layer) => {
                const isSelected = selectedLayer === layer.id;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayer(layer.id)}
                    className={cn(
                      "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-xs",
                      isSelected
                        ? "bg-teal/10 text-teal"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    )}
                  >
                    <layer.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className={cn("flex-1 truncate", !layer.visible && "opacity-40 line-through")}>{layer.name}</span>
                    {isSelected && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
                          className={cn("p-0.5 rounded transition-colors", layer.locked ? "text-teal" : "text-teal/40 hover:text-teal")}
                        >
                          <Lock className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                          className={cn("p-0.5 rounded transition-colors", layer.visible ? "text-teal" : "text-teal/40 hover:text-teal")}
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button className="p-0.5 rounded text-teal/40 hover:text-teal transition-colors">
                          <Star className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Library</p>
                {["3D Models", "Textures", "HDRIs", "Brand Assets", "Templates"].map((cat) => (
                  <div key={cat} className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground cursor-pointer transition-colors">
                    <Layers className="h-3.5 w-3.5" />
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-t border-border/30">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/20">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/50 flex-1">Search...</span>
              <div className="flex items-center gap-0.5 text-muted-foreground/30">
                <Command className="h-3 w-3" />
                <span className="text-[10px]">K</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Canvas ─── */}
        <div
          ref={canvasRef}
          className={cn(
            "flex-1 relative overflow-hidden bg-background",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          onClick={() => { setZoomOpen(false); setAddMenuOpen(false); }}
          onWheel={handleWheel}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onDoubleClick={handleCanvasDoubleClick}
        >
          {/* Dot grid — moves with pan */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: `${24 * zoom / 100}px ${24 * zoom / 100}px`,
              backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
            }}
          />

          {/* ─── Zoom slider (left edge) ─── */}
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 py-2 px-1 rounded-xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoom((prev) => clampZoom(prev + 25))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="relative h-[120px] w-7 flex items-center justify-center">
              <div className="absolute h-full w-1 bg-muted rounded-full" />
              <input
                type="range"
                min={25}
                max={300}
                step={1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="absolute h-[120px] w-[120px] appearance-none bg-transparent cursor-pointer [writing-mode:vertical-lr] [direction:rtl]
                  [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-1
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-card [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1
                  [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-teal [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
            <button
              onClick={() => setZoom((prev) => clampZoom(prev - 25))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="border-t border-border/20 pt-1.5 w-full flex justify-center">
              <span className="text-[9px] font-medium text-muted-foreground/60">{zoom}%</span>
            </div>
          </div>

          {/* Canvas content — zoomed + panned */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
              transformOrigin: "center center",
            }}
          >
            {/*
              Node graph layout (all coordinates relative to center of container)
              Base asset: 580×330, centered at (0,0)
              Variants: 580×330 each, animate from base position outward
              Noodles: bezier curves draw in after click
              Collapsed: variants stacked behind base, invisible
              Expanded: variants fly to final positions, noodles draw in
            */}
            <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>

              {/* SVG noodle layer — behind all assets */}
              <svg
                className="absolute pointer-events-none"
                style={{ left: -400, top: -700, width: 1600, height: 1400, overflow: "visible" }}
                viewBox="-400 -700 1600 1400"
              >
                <defs>
                  <linearGradient id="noodle-green" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#50b89a" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#50b89a" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="noodle-pink" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#f472b6" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="noodle-amber" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
                  </linearGradient>
                </defs>

                {/* Noodle A: base right-top → variant A left-center (top) */}
                <path
                  d="M 290,-55 C 420,-55 420,-400 550,-400"
                  fill="none" stroke="url(#noodle-green)" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="800"
                  strokeDashoffset={variantsExpanded ? 0 : 800}
                  style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s" }}
                />
                <g style={{ opacity: variantsExpanded ? 1 : 0, transition: "opacity 0.4s ease 0.2s" }}>
                  <circle cx="290" cy="-55" r="6" fill="#50b89a" />
                  <circle cx="290" cy="-55" r="10" fill="#50b89a" fillOpacity="0.15" />
                </g>
                <g style={{ opacity: variantsExpanded ? 1 : 0, transition: "opacity 0.4s ease 0.9s" }}>
                  <circle cx="550" cy="-400" r="6" fill="#50b89a" />
                  <circle cx="550" cy="-400" r="10" fill="#50b89a" fillOpacity="0.15" />
                </g>

                {/* Noodle B: base right-center → variant B left-center (middle) */}
                <path
                  d="M 290,0 C 380,0 390,40 420,40 C 450,40 460,0 550,0"
                  fill="none" stroke="url(#noodle-pink)" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="400"
                  strokeDashoffset={variantsExpanded ? 0 : 400}
                  style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.4s" }}
                />
                <g style={{ opacity: variantsExpanded ? 1 : 0, transition: "opacity 0.4s ease 0.3s" }}>
                  <circle cx="290" cy="0" r="6" fill="#f472b6" />
                  <circle cx="290" cy="0" r="10" fill="#f472b6" fillOpacity="0.15" />
                </g>
                <g style={{ opacity: variantsExpanded ? 1 : 0, transition: "opacity 0.4s ease 0.9s" }}>
                  <circle cx="550" cy="0" r="6" fill="#f472b6" />
                  <circle cx="550" cy="0" r="10" fill="#f472b6" fillOpacity="0.15" />
                </g>

                {/* Noodle C: base right-bottom → variant C left-center (bottom) */}
                <path
                  d="M 290,55 C 420,55 420,400 550,400"
                  fill="none" stroke="url(#noodle-amber)" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="800"
                  strokeDashoffset={variantsExpanded ? 0 : 800}
                  style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.5s" }}
                />
                <g style={{ opacity: variantsExpanded ? 1 : 0, transition: "opacity 0.4s ease 0.4s" }}>
                  <circle cx="290" cy="55" r="6" fill="#f59e0b" />
                  <circle cx="290" cy="55" r="10" fill="#f59e0b" fillOpacity="0.15" />
                </g>
                <g style={{ opacity: variantsExpanded ? 1 : 0, transition: "opacity 0.4s ease 1.1s" }}>
                  <circle cx="550" cy="400" r="6" fill="#f59e0b" />
                  <circle cx="550" cy="400" r="10" fill="#f59e0b" fillOpacity="0.15" />
                </g>
              </svg>

              {/* ─── Base asset (center) — clickable to expand ─── */}
              <div
                className="absolute pointer-events-auto cursor-pointer"
                style={{ left: -290, top: -165, width: 580, zIndex: 10 }}
                onClick={(e) => { e.stopPropagation(); setVariantsExpanded((v) => !v); }}
              >
                <div className="absolute -top-8 left-0 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-foreground/80 bg-card/80 backdrop-blur-sm border border-border/30 rounded-md px-2.5 py-1">BASE CREATIVE</span>
                  <span className="text-[10px] text-muted-foreground/50">v1.0</span>
                  {!variantsExpanded && (
                    <span className="text-[9px] text-teal/70 bg-teal/10 border border-teal/20 rounded-md px-2 py-0.5 animate-pulse">Click to expand variants</span>
                  )}
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-2xl shadow-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/creative-hero.jpg" alt="Sobeys Scene+ Summer launch creative" className="w-[580px] h-auto block select-none" draggable={false} />
                  <div className="absolute inset-0 border-2 border-teal/60 rounded-lg pointer-events-none">
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-teal rounded-sm border border-card" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-teal rounded-sm border border-card" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-teal rounded-sm border border-card" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-teal rounded-sm border border-card" />
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-teal rounded-sm border border-card" />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-teal rounded-sm border border-card" />
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-teal rounded-sm border border-card" />
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-teal rounded-sm border border-card" />
                  </div>
                </div>
              </div>

              {/* ─── Variant A — Green BG (top-right) ─── */}
              <div
                className="absolute"
                style={{
                  left: variantsExpanded ? 550 : -290,
                  top: variantsExpanded ? -565 : -165,
                  width: 580,
                  opacity: variantsExpanded ? 1 : 0,
                  transform: variantsExpanded ? "scale(1)" : "scale(0.6)",
                  transition: "left 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s, top 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s, opacity 0.5s ease 0.1s, transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s",
                }}
              >
                <div className="absolute -top-8 left-0 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1">VARIANT A</span>
                  <span className="text-[10px] text-muted-foreground/50">Headline: &quot;Fresh Never Tasted Like Savings&quot;</span>
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-xl shadow-black/30 border border-emerald-500/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/variant-green.png" alt="Variant A — Scene+ headline test: Fresh Never Tasted Like Savings" className="w-[580px] h-auto block select-none" draggable={false} />
                </div>
              </div>

              {/* ─── Variant B — Legends Copy (middle-right) ─── */}
              <div
                className="absolute"
                style={{
                  left: variantsExpanded ? 550 : -290,
                  top: variantsExpanded ? -165 : -165,
                  width: 580,
                  opacity: variantsExpanded ? 1 : 0,
                  transform: variantsExpanded ? "scale(1)" : "scale(0.6)",
                  transition: "left 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s, top 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s, opacity 0.5s ease 0.2s, transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s",
                }}
              >
                <div className="absolute -top-8 left-0 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-md px-2.5 py-1">VARIANT B</span>
                  <span className="text-[10px] text-muted-foreground/50">Desktop Billboard — Summer BBQ lifestyle cut</span>
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-xl shadow-black/30 border border-pink-500/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/variant-pink.avif" alt="Variant B — Summer BBQ Desktop Billboard v1" className="w-[580px] h-auto block select-none" draggable={false} />
                </div>
              </div>

              {/* ─── Variant C — Fresh Produce product swap (bottom-right) ─── */}
              <div
                className="absolute"
                style={{
                  left: variantsExpanded ? 550 : -290,
                  top: variantsExpanded ? 235 : -165,
                  width: 580,
                  opacity: variantsExpanded ? 1 : 0,
                  transform: variantsExpanded ? "scale(1)" : "scale(0.6)",
                  transition: "left 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s, top 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s, opacity 0.5s ease 0.3s, transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s",
                }}
              >
                <div className="absolute -top-8 left-0 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1">VARIANT C</span>
                  <span className="text-[10px] text-muted-foreground/50">Product swap: Summer BBQ → Fresh Produce</span>
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-xl shadow-black/30 border border-amber-500/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/variant-cayenne.png" alt="Variant C — Fresh Produce product swap on same headline" className="w-[580px] h-auto block select-none" draggable={false} />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Bottom prompt bar ─── */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 bg-card border border-border/40 rounded-2xl px-3 py-2 shadow-lg shadow-black/20">
                {/* Add button */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddMenuOpen(!addMenuOpen); }}
                    className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  {addMenuOpen && (
                    <div className="absolute bottom-full mb-2 left-0 bg-card border border-border/40 rounded-xl shadow-xl py-2 min-w-[200px] z-50">
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                        <Image className="h-4 w-4" />
                        Add photos or videos
                      </button>
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                        <Box className="h-4 w-4" />
                        Add 3D objects
                      </button>
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                        <FileText className="h-4 w-4" />
                        Add files (docs, txt...)
                      </button>
                    </div>
                  )}
                </div>

                {/* Inspiration */}
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/20 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <Sparkles className="h-3 w-3 text-teal" />
                  Inspiration
                  <ChevronDown className="h-3 w-3" />
                </button>

                {/* Input */}
                <input
                  ref={promptRef}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your scene..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                />

                {/* Model selector */}
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  Brainwave 2.5
                  <ChevronDown className="h-3 w-3" />
                </button>

                {/* Mic */}
                <button className="p-2 rounded-lg text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <Mic className="h-4 w-4" />
                </button>

                {/* Send */}
                <button
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                    prompt.length > 0
                      ? "bg-teal text-white"
                      : "bg-muted/50 text-muted-foreground/40"
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right Panel ─── */}
        <div className="w-[260px] shrink-0 border-l border-border/30 bg-card flex flex-col overflow-auto">
          {/* Tabs */}
          <div className="flex p-3 gap-1">
            <button
              onClick={() => setRightTab("design")}
              className={cn(
                "flex-1 text-xs font-medium py-2 rounded-lg transition-colors",
                rightTab === "design" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Design
            </button>
            <button
              onClick={() => setRightTab("animation")}
              className={cn(
                "flex-1 text-xs font-medium py-2 rounded-lg transition-colors",
                rightTab === "animation" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Animation
            </button>
          </div>

          {/* Layer context label */}
          <div className="px-4 mb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal/5 border border-teal/10">
              <div className="w-5 h-5 rounded bg-teal/15 flex items-center justify-center">
                {(() => {
                  const layer = layers.find(l => l.id === selectedLayer);
                  if (!layer) return null;
                  const Icon = layer.icon;
                  return <Icon className="h-3 w-3 text-teal" />;
                })()}
              </div>
              <span className="text-[11px] font-medium text-teal">{layers.find(l => l.id === selectedLayer)?.name}</span>
            </div>
          </div>

          {rightTab === "design" ? (
            <div className="px-4 pb-4 space-y-6">

              {/* ═══ BACKGROUND LAYER ═══ */}
              {LAYER_CATEGORIES[selectedLayer] === "background" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold">Environment</p>
                      <button className="flex items-center gap-1 text-[10px] text-teal hover:text-teal/80 transition-colors">
                        <Sparkles className="h-3 w-3" /> Generate
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "rose", gradient: "from-rose-300 to-rose-200", label: "Rose Studio" },
                        { id: "dark", gradient: "from-zinc-900 to-zinc-800", label: "Dark Studio" },
                        { id: "desert", gradient: "from-amber-200 to-orange-100", label: "Desert" },
                        { id: "urban", gradient: "from-slate-500 to-slate-400", label: "Urban" },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setSelectedBgPreset(preset.id)}
                          className={cn(
                            "aspect-video rounded-xl bg-gradient-to-br border-2 transition-all relative overflow-hidden",
                            preset.gradient,
                            selectedBgPreset === preset.id
                              ? "border-teal shadow-lg shadow-teal/20"
                              : "border-border/20 hover:border-border/40"
                          )}
                        >
                          <span className="absolute bottom-1 left-1.5 text-[9px] font-medium text-white/70 drop-shadow">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Color</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-border/30 shrink-0" style={{ backgroundColor: `#${bgColor}` }} />
                      <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))}
                        className="w-20 bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs font-mono text-muted-foreground outline-none focus:border-teal/50" />
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} max={100} value={bgOpacity} onChange={(e) => setBgOpacity(Math.min(100, Math.max(0, Number(e.target.value))))}
                          className="w-12 bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-muted-foreground outline-none focus:border-teal/50 text-center" />
                        <span className="text-[10px] text-muted-foreground/50">%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Gradient</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Direction</span>
                        <div className="flex gap-1">
                          {["↑", "↗", "→", "↘"].map((dir) => (
                            <div key={dir} className="w-6 h-6 rounded bg-muted/30 border border-border/20 flex items-center justify-center text-[10px] text-muted-foreground cursor-pointer hover:border-border/40">{dir}</div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Falloff</span>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full w-[60%] bg-teal/60 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ═══ PRODUCT LAYER ═══ */}
              {LAYER_CATEGORIES[selectedLayer] === "product" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold">Model</p>
                      <button className="flex items-center gap-1 text-[10px] text-teal hover:text-teal/80 transition-colors">
                        <Sparkles className="h-3 w-3" /> Swap
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "lightning", label: "Hero Product Shot" },
                        { id: "ford-oval", label: "Sobeys Logo" },
                        { id: "bronco", label: "Price Burst" },
                        { id: "mach-e", label: "Scene+ Badge" },
                      ].map((model) => (
                        <div key={model.id} className={cn(
                          "p-2.5 rounded-xl border cursor-pointer transition-all text-center",
                          (selectedLayer === model.id || (selectedLayer === "sapphire" && model.id === "sapphire") || (selectedLayer === "shield" && model.id === "shield"))
                            ? "border-teal bg-teal/5 text-teal"
                            : "border-border/20 bg-muted/20 text-muted-foreground hover:border-border/40"
                        )}>
                          <Box className="h-5 w-5 mx-auto mb-1.5" />
                          <p className="text-[10px] font-medium">{model.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Angle</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "front", label: "Front" },
                        { id: "3-quarter", label: "¾ View" },
                        { id: "side", label: "Side" },
                        { id: "rear", label: "Rear" },
                        { id: "top", label: "Top" },
                        { id: "hero", label: "Hero" },
                      ].map((angle) => (
                        <button key={angle.id} onClick={() => setSelectedProductAngle(angle.id)}
                          className={cn(
                            "text-center p-2 rounded-lg border text-[10px] font-medium transition-colors",
                            selectedProductAngle === angle.id
                              ? "border-teal bg-teal/5 text-teal"
                              : "border-border/20 bg-muted/30 text-muted-foreground hover:border-border/40"
                          )}>
                          {angle.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Color Variant</p>
                    <div className="flex gap-2">
                      {[
                        { id: "white", color: "#E8E8E8", label: "White" },
                        { id: "black", color: "#1A1A1A", label: "Black" },
                        { id: "navy", color: "#002D72", label: "Sobeys Navy" },
                        { id: "gold", color: "#B8860B", label: "Compliments Gold" },
                        { id: "slate", color: "#4A5568", label: "Slate" },
                      ].map((c) => (
                        <button key={c.id} onClick={() => setSelectedProductColor(c.id)} title={c.label}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            selectedProductColor === c.id ? "border-teal scale-110 shadow-lg" : "border-border/30 hover:scale-105"
                          )}
                          style={{ backgroundColor: c.color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Transform</p>
                    <div className="space-y-2">
                      {[{ label: "Scale", value: 100 }, { label: "Rotation", value: 15 }, { label: "Position Y", value: 50 }].map((t) => (
                        <div key={t.label} className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{t.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-teal/60 rounded-full" style={{ width: `${t.value}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 w-6 text-right">{t.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══ COPY LAYER ═══ */}
              {LAYER_CATEGORIES[selectedLayer] === "copy" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold">Headline</p>
                      <button className="flex items-center gap-1 text-[10px] text-teal hover:text-teal/80 transition-colors">
                        <Sparkles className="h-3 w-3" /> Rewrite
                      </button>
                    </div>
                    <textarea
                      value={headlineText}
                      onChange={(e) => setHeadlineText(e.target.value)}
                      rows={3}
                      className="w-full bg-muted/30 border border-border/20 rounded-lg px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-teal/50 resize-none"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Typography</p>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] text-muted-foreground mb-1 block">Font</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {["Impact", "Helvetica", "Futura", "Bebas Neue"].map((font) => (
                            <button key={font} onClick={() => setSelectedFont(font)}
                              className={cn(
                                "text-center p-2 rounded-lg border text-[10px] font-medium transition-colors",
                                selectedFont === font
                                  ? "border-teal bg-teal/5 text-teal"
                                  : "border-border/20 bg-muted/30 text-muted-foreground hover:border-border/40"
                              )}>
                              {font}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Size</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-teal/60 rounded-full" style={{ width: `${(fontSize / 120) * 100}%` }} />
                          </div>
                          <input type="number" min={12} max={120} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                            className="w-10 bg-muted/30 border border-border/20 rounded px-1 py-0.5 text-[10px] text-muted-foreground outline-none text-center" />
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground mb-1.5 block">Color</span>
                        <div className="flex gap-2">
                          {["#FFFFFF", "#1A1A1A", "#D4A0A0", "#50B89A"].map((c) => (
                            <div key={c} className="w-7 h-7 rounded-full border border-border/30 cursor-pointer hover:scale-105 transition-transform" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground mb-1.5 block">Alignment</span>
                        <div className="flex gap-1">
                          {["Left", "Center", "Right"].map((align) => (
                            <button key={align} className={cn(
                              "flex-1 text-center text-[10px] py-1.5 rounded-lg font-medium transition-colors",
                              align === "Center" ? "bg-muted text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                            )}>{align}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold">AI Copy Variants</p>
                    </div>
                    <div className="space-y-1.5">
                      {["FRESH NEVER TASTED LIKE SAVINGS.", "MORE SCENE+ POINTS. MORE SUMMER.", "REAL FOOD. REAL VALUE. SO CANADIAN."].map((variant) => (
                        <div key={variant} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/20 cursor-pointer hover:border-teal/30 hover:bg-teal/5 transition-colors">
                          <Sparkles className="h-3 w-3 text-teal/50 shrink-0" />
                          <span className="text-[11px] font-semibold truncate">{variant}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══ EFFECTS LAYER ═══ */}
              {LAYER_CATEGORIES[selectedLayer] === "effects" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold">Effect Style</p>
                      <button className="flex items-center gap-1 text-[10px] text-teal hover:text-teal/80 transition-colors">
                        <Sparkles className="h-3 w-3" /> Generate
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "drip", label: "Paint Drip", gradient: "from-emerald-400 to-blue-400" },
                        { id: "splash", label: "Splash", gradient: "from-rose-400 to-amber-400" },
                        { id: "spray", label: "Spray", gradient: "from-violet-400 to-indigo-400" },
                        { id: "brush", label: "Brush Stroke", gradient: "from-teal to-emerald-400" },
                      ].map((effect) => (
                        <button key={effect.id} onClick={() => setSelectedEffectStyle(effect.id)}
                          className={cn(
                            "aspect-video rounded-xl bg-gradient-to-br border-2 transition-all relative overflow-hidden",
                            effect.gradient,
                            selectedEffectStyle === effect.id ? "border-teal shadow-lg shadow-teal/20" : "border-border/20 hover:border-border/40"
                          )}>
                          <span className="absolute bottom-1 left-1.5 text-[9px] font-medium text-white/80 drop-shadow">{effect.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Colors</p>
                    <div className="flex gap-2 flex-wrap">
                      {["#22C55E", "#3B82F6", "#EF4444", "#F97316", "#A855F7", "#FFFFFF"].map((c) => (
                        <div key={c} className="w-8 h-8 rounded-full border-2 border-border/30 cursor-pointer hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} />
                      ))}
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-border/30 flex items-center justify-center cursor-pointer hover:border-border/50">
                        <Plus className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Adjustments</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Intensity</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-teal/60 rounded-full" style={{ width: `${effectIntensity}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 w-6 text-right">{effectIntensity}</span>
                        </div>
                      </div>
                      {[{ label: "Spread", value: 65 }, { label: "Opacity", value: 90 }, { label: "Blur", value: 10 }].map((adj) => (
                        <div key={adj.label} className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{adj.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-teal/60 rounded-full" style={{ width: `${adj.value}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 w-6 text-right">{adj.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══ LIGHTING LAYER ═══ */}
              {LAYER_CATEGORIES[selectedLayer] === "lighting" && (
                <>
                  <div>
                    <p className="text-xs font-semibold mb-3">Light Type</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "dome", label: "Dome", desc: "Ambient fill" },
                        { id: "key", label: "Key", desc: "Primary source" },
                        { id: "area", label: "Area", desc: "Soft panel" },
                        { id: "spot", label: "Spot", desc: "Focused beam" },
                      ].map((lt) => (
                        <div key={lt.id} className={cn(
                          "p-2.5 rounded-lg border cursor-pointer transition-colors",
                          (selectedLayer === lt.id || selectedLayer === "cam1")
                            ? "border-teal/30 bg-teal/5"
                            : "border-border/20 bg-muted/20 hover:border-border/40"
                        )}>
                          <p className="text-[10px] font-medium text-foreground">{lt.label}</p>
                          <p className="text-[9px] text-muted-foreground/60">{lt.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Properties</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Intensity</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400/60 rounded-full" style={{ width: `${lightIntensity}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 w-6 text-right">{lightIntensity}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Temperature</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #60A5FA, #FDE68A, #F97316)" }}>
                            <div className="h-full" style={{ width: `${lightTemp}%`, background: "transparent", borderRight: "2px solid white" }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 w-8 text-right">{Math.round(3000 + (lightTemp / 100) * 4000)}K</span>
                        </div>
                      </div>
                      {[{ label: "Softness", value: 70 }, { label: "Angle", value: 45 }].map((p) => (
                        <div key={p.label} className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{p.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400/60 rounded-full" style={{ width: `${p.value}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 w-6 text-right">{p.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-3">Color</p>
                    <div className="flex gap-2">
                      {["#FFFFFF", "#FDE68A", "#FCA5A5", "#93C5FD", "#A5F3FC"].map((c) => (
                        <div key={c} className="w-7 h-7 rounded-full border border-border/30 cursor-pointer hover:scale-105 transition-transform" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ─── Format (always visible) ─── */}
              <div className="pt-2 border-t border-border/20">
                <p className="text-xs font-semibold mb-3">Output Format</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Feed", ratio: "1:1" },
                    { label: "Story", ratio: "9:16" },
                    { label: "Wide", ratio: "16:9" },
                  ].map((fmt) => (
                    <div key={fmt.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border/20 cursor-pointer hover:border-border/40 transition-colors">
                      <p className="text-[10px] font-medium text-muted-foreground">{fmt.label}</p>
                      <p className="text-[9px] text-muted-foreground/50">{fmt.ratio}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-6">
              {/* Animation panel */}
              <div>
                <p className="text-xs font-semibold mb-3">Keyframes</p>
                <div className="space-y-2">
                  {["Entrance", "Camera Pan", "Text Reveal", "CTA Bounce"].map((kf, i) => (
                    <div key={kf} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/20">
                      <div className="w-6 h-6 rounded bg-teal/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-teal">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate">{kf}</p>
                        <p className="text-[9px] text-muted-foreground">{(i * 2)}s — {(i * 2 + 2)}s</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-3">Easing</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Ease In", "Ease Out", "Spring", "Linear"].map((ease) => (
                    <div key={ease} className="text-center p-2 rounded-lg bg-muted/30 border border-border/20 cursor-pointer hover:border-border/40 transition-colors">
                      <p className="text-[10px] font-medium text-muted-foreground">{ease}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-3">Timeline</p>
                <div className="h-16 rounded-lg bg-muted/20 border border-border/20 relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-[30%] bg-teal/10 border-r border-teal/30" />
                  <div className="absolute top-0 left-[30%] bottom-0 w-[25%] bg-indigo-500/10 border-r border-indigo-500/30" />
                  <div className="absolute top-0 left-[55%] bottom-0 w-[20%] bg-amber-500/10 border-r border-amber-500/30" />
                  <div className="absolute top-0 left-[75%] bottom-0 w-[15%] bg-rose-500/10" />
                  <div className="absolute top-0 bottom-0 left-[45%] w-px bg-foreground/60">
                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rounded-full" />
                  </div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground/50">0s</span>
                  <span className="text-[9px] text-muted-foreground/50">4s</span>
                  <span className="text-[9px] text-muted-foreground/50">8s</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
