"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { useProgressiveImage } from "./ImageLoader";
import { VirtualizedPlots } from "./VirtualizedPlots";
import { extractVillaKey } from "./idUtil";
import { AnimatePresence } from "framer-motion";
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
    let any = false;
    if (f.availability.size || f.facing.size || f.sqftRange || f.plotSizeRange) any = true;
    if (!any) {
      setMatchedPlotIds(new Set());
      setHasActiveFilters(false);
      return;
    }
    const ids = new Set();
    for (const p of derivedPlots) {
      if (p.plotType !== 'villa') continue;
      const sd = p.sheetData || {};
      // availability
      if (f.availability.size && !f.availability.has(sd.availability)) continue;
      // facing
      if (f.facing.size && !f.facing.has(sd.facing)) continue;
      // sqft
      if (f.sqftRange) {
        const s = parseNum(sd.sqft);
        if (!(Number.isFinite(s) && s >= f.sqftRange[0] && s <= f.sqftRange[1])) continue;
      }
      // plot size
      if (f.plotSizeRange) {
        const ps = parseNum(sd.plotSize);
        if (!(Number.isFinite(ps) && ps >= f.plotSizeRange[0] && ps <= f.plotSizeRange[1])) continue;
      }
      ids.add(p.id);
    }
    setMatchedPlotIds(ids);
    setHasActiveFilters(ids.size > 0);
  }, [derivedPlots, parseNum]);


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
          <div
            onClick={() => setShowFilters(!showFilters)}
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              width: 112, // 28 * 4
              height: 40,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 8,
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none'
            }}
          >
            Filter
          </div>

          {/* Panel */}
          {showFilters && (
            <div
              style={{
                position: 'fixed',
                top: 80,
                right: 24,
                width: 224,
                backgroundColor: '#1f2937',
                color: '#ffffff',
                borderRadius: 8,
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.1)',
                padding: 16,
                pointerEvents: 'auto'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Villa Filters</div>
              {/* Availability */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Availability</div>
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
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
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
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Facing</div>
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
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
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
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Sq. Ft</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
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
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Plot Size (SqYds)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
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