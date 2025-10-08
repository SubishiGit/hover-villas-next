"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { useProgressiveImage } from "./ImageLoader";
import { VirtualizedPlots } from "./VirtualizedPlots";
import { extractVillaKey } from "./idUtil";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip } from "./Tooltip";
import UILayerPortal from "./UILayerPortal";
import { Range, getTrackBackground } from "react-range";

export default function MasterPlan({ mapData, sheetRows = [] }) {
  const [activePlot, setActivePlot] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Simple filter state for future expansion
  const [showFilters, setShowFilters] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [matchedPlotIds, setMatchedPlotIds] = useState(new Set());
  const [filters, setFilters] = useState({
    availability: new Set(),
    facing: new Set(),
    sqftRange: null, // [min,max]
    plotSizeRange: null // [min,max]
  });
  // Track which thumb is active to control z-index so overlapped thumbs work like one control
  const [activeThumb, setActiveThumb] = useState(null); // kept if needed later
  const [isFilterHover, setIsFilterHover] = useState(false);
  
  // Progressive image loading
  const { currentSrc, isLoading } = useProgressiveImage('/baselayer');
  
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

  // Safe numeric parser that strips commas/whitespace
  const parseNum = useCallback((value) => {
    if (value === null || value === undefined) return NaN;
    const s = String(value).replace(/[,\s]/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }, []);

  // Bounds for ranges
  const sqftBounds = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const p of derivedPlots) {
      if (p.plotType === 'villa') {
        const v = parseNum(p.sheetData?.sqft);
        if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
      }
    }
    return (min === Infinity || max === -Infinity) ? { min: 0, max: 0 } : { min, max };
  }, [derivedPlots, parseNum]);

  const plotSizeBounds = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const p of derivedPlots) {
      if (p.plotType === 'villa') {
        const v = parseNum(p.sheetData?.plotSize);
        if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
      }
    }
    return (min === Infinity || max === -Infinity) ? { min: 0, max: 0 } : { min, max };
  }, [derivedPlots, parseNum]);

  // Initialize ranges to full bounds once
  useEffect(() => {
    setFilters(prev => {
      const next = { ...prev };
      if (!next.sqftRange && (sqftBounds.max > sqftBounds.min)) next.sqftRange = [sqftBounds.min, sqftBounds.max];
      if (!next.plotSizeRange && (plotSizeBounds.max > plotSizeBounds.min)) next.plotSizeRange = [plotSizeBounds.min, plotSizeBounds.max];
      return next;
    });
  }, [sqftBounds.min, sqftBounds.max, plotSizeBounds.min, plotSizeBounds.max]);

  const computeMatchesFromFilters = useCallback((f) => {
    // consider ranges active only if narrowed from data bounds
    const sqftActive = !!(f.sqftRange && (f.sqftRange[0] > (sqftBounds.min ?? 0) || f.sqftRange[1] < (sqftBounds.max ?? 0)));
    const plotActive = !!(f.plotSizeRange && (f.plotSizeRange[0] > (plotSizeBounds.min ?? 0) || f.plotSizeRange[1] < (plotSizeBounds.max ?? 0)));
    const any = f.availability.size || f.facing.size || sqftActive || plotActive;
    if (!any) {
      setMatchedPlotIds(new Set());
      setHasActiveFilters(false);
      return;
    }
    const ids = new Set();
    for (const p of derivedPlots) {
      if (p.plotType !== 'villa') continue;
      const sd = p.sheetData || {};
      if (f.availability.size && !f.availability.has(sd.availability)) continue;
      if (f.facing.size && !f.facing.has(sd.facing)) continue;
      if (sqftActive) {
        const s = parseNum(sd.sqft);
        if (!(Number.isFinite(s) && s >= f.sqftRange[0] && s <= f.sqftRange[1])) continue;
      }
      if (plotActive) {
        const ps = parseNum(sd.plotSize);
        if (!(Number.isFinite(ps) && ps >= f.plotSizeRange[0] && ps <= f.plotSizeRange[1])) continue;
      }
      ids.add(p.id);
    }
    setMatchedPlotIds(ids);
    setHasActiveFilters(ids.size > 0);
  }, [derivedPlots, parseNum, sqftBounds.min, sqftBounds.max, plotSizeBounds.min, plotSizeBounds.max]);


  // Optimized mouse handlers with error handling
  const handleMouseMove = useCallback((e) => {
    const x = Number.isFinite(e.clientX) ? e.clientX : 0;
    const y = Number.isFinite(e.clientY) ? e.clientY : 0;
    setMousePosition({ x, y });
    
    // Clear tooltip if mouse is moving over background (not over SVG polygons)
    // This handles cases where mouse moves to empty areas between polygons
    if (e.target === e.currentTarget) {
      setActivePlot(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActivePlot(null);
  }, []);

  const handlePlotHover = useCallback((plot) => {
    setActivePlot(plot);
  }, []);

  const handlePlotLeave = useCallback(() => {
    setActivePlot(null);
  }, []);

  // Safe zoom change handler to prevent NaN values and clear tooltip during zoom
  const handleZoomChange = useCallback((zoom) => {
    const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    setCurrentZoom(safeZoom);
    // Clear tooltip when zooming to avoid stale tooltips
    setActivePlot(null);
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
            <p>Loading Master Plan...</p>
          </div>
        </div>
      )}

      <InteractiveCanvas
        minZoom={containerSize.width < 768 ? 0.7 : 0.6}
        maxZoom={containerSize.width < 768 ? 5 : 8}
        initialZoom={containerSize.width < 768 ? 0.8 : 0.9}
        onZoomChange={handleZoomChange}
      >
        <div 
          style={{ 
            position: 'relative',
            width: '100vw',
            height: '100vh',
            minWidth: '100%',
            minHeight: '100%'
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
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
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
            onPlotLeave={handlePlotLeave}
            activePlotId={activePlot?.id}
            matchedPlotIds={matchedPlotIds}
            hasActiveFilters={hasActiveFilters}
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

      {/* Outer-layer UI via portal with padded position */}
      <UILayerPortal>
        {/* Use pure inline styles to avoid any utility class conflicts */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
          {/* Button */}
          {/* Hover swap: icon-only -> expanded button in same position */}
          <div
            onMouseEnter={() => setIsFilterHover(true)}
            onMouseLeave={() => setIsFilterHover(false)}
            style={{ position: 'fixed', top: 24, right: 24, pointerEvents: 'auto', height: 36 }}
          >
            <AnimatePresence initial={false}>
              {!isFilterHover && (
                <motion.button
                  key="icon-only"
                  onClick={() => setShowFilters(!showFilters)}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 140, damping: 16, mass: 0.9, bounce: 0.35 }}
                  aria-label="Open filters"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'rgba(20,20,20,0.6)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    width: 36,
                    height: 36,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="#e5e7eb"/>
                  </svg>
                </motion.button>
              )}
              {isFilterHover && (
                <motion.button
                  key="expanded"
                  onClick={() => setShowFilters(!showFilters)}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 130, damping: 15, mass: 0.95, bounce: 0.3 }}
                  aria-label="Open filters"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'rgba(20,20,20,0.6)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="#e5e7eb"/>
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Filter</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Panel */}
          {showFilters && (
            <div
              style={{
                position: 'fixed',
                top: 72,
                right: 16,
                background: 'rgba(20,20,20,0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.55)',
                pointerEvents: 'auto',
                padding: 10,
                width: 'min(220px, 85vw)',
                maxHeight: '50vh',
                overflow: 'hidden auto'
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: 0.2 }}>Villa Filters</div>
              {/* Availability */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#D1D5DB', marginBottom: 6 }}>Availability</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Available','Sold','Blocked'].map(label => {
                    const isSelected = filters.availability?.has(label);
                    const bg = isSelected
                      ? (label === 'Available' ? '#06b6d4' : label === 'Sold' ? '#ef4444' : '#eab308')
                      : '#374151';
                    const color = isSelected
                      ? (label === 'Blocked' ? '#000' : '#fff')
                      : '#D1D5DB';
                    return (
                      <div key={label}
                        onClick={() => {
                          setFilters(prev => {
                            const next = { ...prev, availability: new Set(prev.availability) };
                            if (next.availability.has(label)) next.availability.delete(label); else next.availability.add(label);
                            computeMatchesFromFilters(next);
                            return next;
                          });
                        }}
                        style={{
                          backgroundColor: bg,
                          color,
                        padding: '5px 8px',
                        borderRadius: 8,
                        fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Facing */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#D1D5DB', marginBottom: 6 }}>Facing</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['East','West','North','South'].map(f => (
                    <div key={f}
                      onClick={() => {
                        setFilters(prev => {
                          const next = { ...prev, facing: new Set(prev.facing) };
                          if (next.facing.has(f)) next.facing.delete(f); else next.facing.add(f);
                          computeMatchesFromFilters(next);
                          return next;
                        });
                      }}
                      style={{
                        backgroundColor: '#374151',
                        color: '#D1D5DB',
                        padding: '5px 8px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: filters.facing?.has(f) ? '0 0 0 2px #10b981 inset' : 'none'
                      }}
                    >
                      {f}
                    </div>
                  ))}
                </div>
              </div>

            {/* Sq. Ft Range - react-range dual thumb */}
            {(sqftBounds.max > sqftBounds.min) && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#D1D5DB', marginBottom: 6 }}>Sq. Ft</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#D1D5DB', marginBottom: 6 }}>
                  <span>{Math.round((filters.sqftRange?.[0] ?? sqftBounds.min)).toLocaleString()}</span>
                  <span>{Math.round((filters.sqftRange?.[1] ?? sqftBounds.max)).toLocaleString()}</span>
                </div>
                <Range
                  values={[filters.sqftRange ? filters.sqftRange[0] : sqftBounds.min, filters.sqftRange ? filters.sqftRange[1] : sqftBounds.max]}
                  step={1}
                  min={Math.floor(sqftBounds.min)}
                  max={Math.ceil(sqftBounds.max)}
                  onChange={(vals) => {
                    const next = { ...filters, sqftRange: [vals[0], vals[1]] };
                    setFilters(next);
                    computeMatchesFromFilters(next);
                  }}
                  renderTrack={({ props, children }) => (
                    <div
                      onMouseDown={props.onMouseDown}
                      onTouchStart={props.onTouchStart}
                      style={{ ...props.style, height: 24, display: 'flex', width: '100%' }}
                    >
                      <div
                        ref={props.ref}
                        style={{
                          height: 6,
                          width: '100%',
                          borderRadius: 4,
                          background: getTrackBackground({
                            values: [filters.sqftRange ? filters.sqftRange[0] : sqftBounds.min, filters.sqftRange ? filters.sqftRange[1] : sqftBounds.max],
                            colors: ['#4b5563', '#06b6d4', '#4b5563'],
                            min: Math.floor(sqftBounds.min),
                            max: Math.ceil(sqftBounds.max)
                          }),
                          alignSelf: 'center'
                        }}
                      >
                        {children}
                      </div>
                    </div>
                  )}
                  renderThumb={({ props }) => {
                    const { key, style, ...rest } = props;
                    return (
                      <div
                        key={key}
                        {...rest}
                        style={{
                          ...style,
                          height: 18,
                          width: 18,
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          border: '2px solid #06b6d4'
                        }}
                      />
                    );
                  }}
                />
              </div>
            )}

            {/* Plot Size Range (SqYds) - react-range dual thumb */}
            {(plotSizeBounds.max > plotSizeBounds.min) && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#D1D5DB', marginBottom: 6 }}>Plot Size (SqYds)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#D1D5DB', marginBottom: 6 }}>
                  <span>{Math.round((filters.plotSizeRange?.[0] ?? plotSizeBounds.min))}</span>
                  <span>{Math.round((filters.plotSizeRange?.[1] ?? plotSizeBounds.max))}</span>
                </div>
                <Range
                  values={[filters.plotSizeRange ? filters.plotSizeRange[0] : plotSizeBounds.min, filters.plotSizeRange ? filters.plotSizeRange[1] : plotSizeBounds.max]}
                  step={1}
                  min={Math.floor(plotSizeBounds.min)}
                  max={Math.ceil(plotSizeBounds.max)}
                  onChange={(vals) => {
                    const next = { ...filters, plotSizeRange: [vals[0], vals[1]] };
                    setFilters(next);
                    computeMatchesFromFilters(next);
                  }}
                  renderTrack={({ props, children }) => (
                    <div
                      onMouseDown={props.onMouseDown}
                      onTouchStart={props.onTouchStart}
                      style={{ ...props.style, height: 24, display: 'flex', width: '100%' }}
                    >
                      <div
                        ref={props.ref}
                        style={{
                          height: 6,
                          width: '100%',
                          borderRadius: 4,
                          background: getTrackBackground({
                            values: [filters.plotSizeRange ? filters.plotSizeRange[0] : plotSizeBounds.min, filters.plotSizeRange ? filters.plotSizeRange[1] : plotSizeBounds.max],
                            colors: ['#4b5563', '#10b981', '#4b5563'],
                            min: Math.floor(plotSizeBounds.min),
                            max: Math.ceil(plotSizeBounds.max)
                          }),
                          alignSelf: 'center'
                        }}
                      >
                        {children}
                      </div>
                    </div>
                  )}
                  renderThumb={({ props }) => {
                    const { key, style, ...rest } = props;
            return (
                      <div
                        key={key}
                        {...rest}
                        style={{
                          ...style,
                          height: 18,
                          width: 18,
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          border: '2px solid #10b981'
                        }}
                      />
                    );
                  }}
                />
              </div>
            )}

              {/* Clear */}
              <div
                onClick={() => {
                  const reset = {
                    availability: new Set(),
                    facing: new Set(),
                    sqftRange: sqftBounds.max > sqftBounds.min ? [sqftBounds.min, sqftBounds.max] : null,
                    plotSizeRange: plotSizeBounds.max > plotSizeBounds.min ? [plotSizeBounds.min, plotSizeBounds.max] : null
                  };
                  setFilters(reset);
                  computeMatchesFromFilters(reset);
                }}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: 6,
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Clear
              </div>
            </div>
          )}
        </div>
      </UILayerPortal>

    </div>
  );
}