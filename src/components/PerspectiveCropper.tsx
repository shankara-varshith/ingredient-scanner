"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, Crop } from "lucide-react";

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];

interface PerspectiveCropperProps {
  imageSrc: string;
  onCoordinatesChange: (coords: Quad | null) => void;
}

export default function PerspectiveCropper({ imageSrc, onCoordinatesChange }: PerspectiveCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [intrinsic, setIntrinsic] = useState({ w: 1, h: 1 });
  const [loaded, setLoaded] = useState(false);

  // Points as percentages (0 to 100)
  // [TopLeft, TopRight, BottomRight, BottomLeft]
  const [pts, setPts] = useState<Quad>([
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ]);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  // Load image intrinsic size
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setIntrinsic({ w: img.width, h: img.height });
      setLoaded(true);
      // Reset points to a default inset quad
      setPts([
        { x: 15, y: 15 },
        { x: 85, y: 15 },
        { x: 85, y: 85 },
        { x: 15, y: 85 },
      ]);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Report true pixel coordinates whenever pts change
  useEffect(() => {
    if (!loaded) return;
    const realCoords: Quad = pts.map(p => ({
      x: (p.x / 100) * intrinsic.w,
      y: (p.y / 100) * intrinsic.h
    })) as Quad;
    onCoordinatesChange(realCoords);
  }, [pts, loaded, intrinsic, onCoordinatesChange]);

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    setDraggingIdx(idx);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let px = ((e.clientX - rect.left) / rect.width) * 100;
    let py = ((e.clientY - rect.top) / rect.height) * 100;

    // Constrain to 0-100
    px = Math.max(0, Math.min(100, px));
    py = Math.max(0, Math.min(100, py));

    setPts(prev => {
      const newPts = [...prev] as Quad;
      newPts[draggingIdx] = { x: px, y: py };
      return newPts;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingIdx(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!loaded) {
    return <div className="w-full h-full flex items-center justify-center text-slate-500">Loading image...</div>;
  }

  const polygonPoints = pts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-[#050A07]">
      <div 
        ref={containerRef}
        className="relative shadow-2xl"
        style={{ 
          aspectRatio: `${intrinsic.w} / ${intrinsic.h}`,
          maxHeight: '100%', 
          maxWidth: '100%',
          touchAction: 'none'
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img 
          src={imageSrc} 
          alt="To crop" 
          className="w-full h-full block rounded-md select-none pointer-events-none"
        />
        
        {/* SVG Overlay */}
        <svg 
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
        >
          {/* Darkened overlay outside the polygon */}
          <defs>
            <mask id="crop-mask">
              <rect width="100" height="100" fill="white" />
              <polygon points={polygonPoints} fill="black" />
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(0,0,0,0.6)" mask="url(#crop-mask)" />

          {/* Polygon Outline */}
          <polygon 
            points={polygonPoints} 
            fill="rgba(0, 220, 130, 0.1)" 
            stroke="#00DC82" 
            strokeWidth="0.5" 
            strokeLinejoin="round"
          />
        </svg>

        {/* Draggable Handles */}
        {pts.map((p, i) => (
          <div
            key={i}
            className="absolute w-8 h-8 -ml-4 -mt-4 cursor-move flex items-center justify-center touch-none group"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onPointerDown={(e) => handlePointerDown(i, e)}
          >
            <div className={`w-3 h-3 rounded-full border-[1.5px] border-[#00DC82] bg-black shadow-[0_0_10px_rgba(0,220,130,0.8)] transition-transform ${draggingIdx === i ? 'scale-150 bg-[#00DC82]' : 'group-hover:scale-125'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
