"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { useProgressiveImage } from "./ImageLoader";
import { VirtualizedPlots } from "./VirtualizedPlots";
import { extractVillaKey } from "./idUtil";
import { AnimatePresence } from "framer-motion";
import { Tooltip } from "./Tooltip";

export default function MasterPlan({ mapData, sheetRows = [] }) {
  const [activePlot, setActivePlot] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Progressive image loading
  const { currentSrc, isLoading } = useProgressiveImage('/BaseLayer');
  
  // Track container size for responsive behavior
  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setContainerSize({ width, height });
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  // Memoized aspect ratio calculation
  const aspectRatio = useMemo(() => {
    if (!mapData.viewBox) return "16 / 9";
    const [, , width, height] = mapData.viewBox.split(' ').map(Number);
    return width && height ? `${width} / ${height}` : "16 / 9";
  }, [mapData.viewBox]);
  
  // Calculate responsive dimensions
  const responsiveDimensions = useMemo(() => {
    const isMobile = containerSize.width < 768;
    const isTablet = containerSize.width >= 768 && containerSize.width < 1024;
    
    if (isMobile) {
      // Mobile: Use full screen width, let height adjust naturally
      return {
        width: '100%',
        minWidth: 'auto',
        minHeight: 'auto',
        maxWidth: 'none',
        aspectRatio: aspectRatio
      };
    } else if (isTablet) {
      // Tablet: Slightly larger minimum with responsive scaling
      return {
        width: '100%',
        minWidth: '600px',
        minHeight: '400px', 
        maxWidth: '900px',
        aspectRatio: aspectRatio
      };
    } else {
      // Desktop: Current behavior but with responsive max
      return {
        width: '100%',
        minWidth: '800px',
        minHeight: '500px',
        maxWidth: '1800px',
        aspectRatio: aspectRatio
      };
    }
  }, [containerSize.width, aspectRatio]);
  
  
  // Optimized villa data mapping with caching
  const villaDataMap = useMemo(() => {
    const map = new Map();
    for (const row of sheetRows) {
      const key = extractVillaKey(row.id);
      if (key) map.set(key, row);
    }
    return map;
  }, [sheetRows]);

  // Derived plots with performance optimization
  const derivedPlots = useMemo(() => {
    if (!mapData.plots) return [];
    
    return mapData.plots.map(plot => {
      let plotType = 'villa', color = 'transparent', sheetData = null;
      
      if (/CLUBHOUSE/i.test(plot.id)) {
        plotType = 'clubhouse';
        color = "rgba(168, 85, 247, 0.7)";
      } else if (/CANAL|LANDSCAPE/i.test(plot.id)) {
        plotType = 'canal';
        color = "rgba(59, 130, 246, 0.7)";
      } else {
        const key = extractVillaKey(plot.id);
        sheetData = key ? villaDataMap.get(key) : null;
        
        if (sheetData) {
          switch (sheetData.availability) {
            case "Sold": color = "rgba(255, 0, 0, 0.6)"; break;
            case "Blocked": color = "rgba(255, 255, 0, 0.6)"; break;
            default: color = "rgba(0, 255, 255, 0.6)";
          }
        }
      }
      
      return { ...plot, plotType, sheetData, color };
    });
  }, [mapData.plots, villaDataMap]);

  // Optimized mouse handlers
  const handleMouseMove = useCallback((e) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActivePlot(null);
  }, []);

  const handlePlotHover = useCallback((plot) => {
    setActivePlot(plot);
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
            <p>Loading Master Plan...</p>
          </div>
        </div>
      )}

      <InteractiveCanvas
        minZoom={containerSize.width < 768 ? 0.5 : 0.1}
        maxZoom={containerSize.width < 768 ? 3 : 10}
        initialZoom={1}
        bounds="auto"
        onZoomChange={setCurrentZoom}
      >
        <div 
          style={{ 
            position: 'relative',
            ...responsiveDimensions
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Base Layer Image */}
          <img
            src={currentSrc}
            alt="Master Plan Base Layer"
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              pointerEvents: 'none'
            }}
            draggable={false}
          />

          {/* Interactive Plot Layer */}
          <VirtualizedPlots
            plots={derivedPlots}
            viewBox={mapData.viewBox}
            currentZoom={currentZoom}
            onPlotHover={handlePlotHover}
            activePlotId={activePlot?.id}
          />
        </div>
      </InteractiveCanvas>

      {/* Enhanced Tooltip */}
      <AnimatePresence>
        {activePlot && (
          <Tooltip 
            activePlot={activePlot} 
            position={mousePosition}
            zoomLevel={currentZoom}
          />
        )}
      </AnimatePresence>
    </div>
  );
}