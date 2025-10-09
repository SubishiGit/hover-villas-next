"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
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
  const [showInstructions, setShowInstructions] = useState(true);
  const filterBtnRef = useRef(null);
  const panelRef = useRef(null);
  // Responsive sizes for the filter button (desktop gets ~400% scale)
  const [btnUi, setBtnUi] = useState({ icon: 18, btn: 36, padX: 8, padY: 6, gap: 8, font: 14 });
  // Responsive sizes for instructions overlay
  const [instructionsUi, setInstructionsUi] = useState({ 
    title: 20, body: 14, button: 14, padding: 24, maxWidth: 400
  });
  // Responsive sizes for filter panel
  const [filterPanelUi, setFilterPanelUi] = useState({ 
    width: 220, padding: 10, fontSize: 12, buttonSize: 10
  });

  useEffect(() => {
    const updateBtnUi = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
      if (w >= 1024) {
        // Desktop: icon/button 60px
        setBtnUi({ icon: 60, btn: 60, padX: 12, padY: 10, gap: 12, font: 18 });
        setInstructionsUi({ 
          title: 28, body: 18, button: 16, padding: 40, maxWidth: 600
        });
        // Update filter panel size for desktop
        setFilterPanelUi({ 
          width: 320, padding: 20, fontSize: 14, buttonSize: 12
        });
      } else if (w >= 768) {
        // Tablet
        setBtnUi({ icon: 24, btn: 38, padX: 9, padY: 7, gap: 9, font: 15 });
        setInstructionsUi({ 
          title: 24, body: 16, button: 15, padding: 32, maxWidth: 500
        });
        setFilterPanelUi({ 
          width: 260, padding: 16, fontSize: 13, buttonSize: 11
        });
      } else {
        // Mobile
        setBtnUi({ icon: 18, btn: 36, padX: 8, padY: 6, gap: 8, font: 14 });
        setInstructionsUi({ 
          title: 16, body: 12, button: 12, padding: 16, maxWidth: 300
        });
        setFilterPanelUi({ 
          width: 220, padding: 10, fontSize: 12, buttonSize: 10
        });
      }
    };
    updateBtnUi();
    window.addEventListener('resize', updateBtnUi);
    return () => window.removeEventListener('resize', updateBtnUi);
  }, []);
  
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

  // Close filter panel on click-away (outside button and panel)
  useEffect(() => {
    if (!showFilters) return;
    const handlePointerDown = (e) => {
      const target = e.target;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (filterBtnRef.current && filterBtnRef.current.contains(target)) return;
      setShowFilters(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showFilters]);
  
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

  // Detect if any filters are applied (independent of whether matches exist)
  const filtersApplied = useMemo(() => {
    const sqftActive = !!(filters.sqftRange && (filters.sqftRange[0] > (sqftBounds.min ?? 0) || filters.sqftRange[1] < (sqftBounds.max ?? 0)));
    const plotActive = !!(filters.plotSizeRange && (filters.plotSizeRange[0] > (plotSizeBounds.min ?? 0) || filters.plotSizeRange[1] < (plotSizeBounds.max ?? 0)));
    return (filters.availability?.size || 0) > 0 || (filters.facing?.size || 0) > 0 || sqftActive || plotActive;
  }, [filters, sqftBounds.min, sqftBounds.max, plotSizeBounds.min, plotSizeBounds.max]);

  // Build a concise summary of applied filters for the button
  const filterSummaryContent = useMemo(() => {
    if (!filtersApplied) return null;

    const statusColors = {
      Available: '#06b6d4',
      Sold: '#ef4444',
      Blocked: '#eab308'
    };

    const availabilityParts = Array.from(filters.availability || [])
      .map((s) => (
        <span key={s} style={{ color: statusColors[s] || '#D1D5DB', fontWeight: 700 }}>{s}</span>
      ));

    const facingArr = Array.from(filters.facing || []);
    const facingPart = facingArr.length > 0 ? (
      <span key="facing" style={{ color: '#000000' }}>
        {availabilityParts.length ? ' ' : ''}
        {facingArr.join('/')} Facing Villas
      </span>
    ) : null;

    const sqftActive = !!(filters.sqftRange && (filters.sqftRange[0] > (sqftBounds.min ?? 0) || filters.sqftRange[1] < (sqftBounds.max ?? 0)));
    const plotActive = !!(filters.plotSizeRange && (filters.plotSizeRange[0] > (plotSizeBounds.min ?? 0) || filters.plotSizeRange[1] < (plotSizeBounds.max ?? 0)));

    const rangeParts = [];
    if (sqftActive) {
      rangeParts.push(
        <span key="sqft" style={{ color: '#000000' }}>
          {`${Math.round(filters.sqftRange[0]).toLocaleString()}–${Math.round(filters.sqftRange[1]).toLocaleString()} Sq. Ft`}
        </span>
      );
    }
    if (plotActive) {
      rangeParts.push(
        <span key="plot" style={{ color: '#000000' }}>
          {`${Math.round(filters.plotSizeRange[0])}–${Math.round(filters.plotSizeRange[1])} SqYds`}
        </span>
      );
    }

    const pieces = [];
    if (availabilityParts.length) pieces.push(<span key="avail">{availabilityParts.reduce((acc, el, idx) => idx === 0 ? [el] : [...acc, <span key={`sep-a-${idx}`} style={{ color: '#9CA3AF' }}> / </span>, el], [])}</span>);
    if (facingPart) pieces.push(
      <span key="facing-wrap">
        {facingPart}
      </span>
    );
    if (rangeParts.length) {
      rangeParts.forEach((rp, idx) => {
        pieces.push(
          <span key={`range-${idx}`}>
            {pieces.length ? <span style={{ color: '#000000' }}>, </span> : null}
            {rp}
          </span>
        );
      });
    }

    if (pieces.length === 0) return null;

    return (
      <span style={{ fontSize: btnUi.font, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Ubuntu, sans-serif' }}>
        {pieces}
      </span>
    );
  }, [filtersApplied, filters, btnUi.font, sqftBounds.min, sqftBounds.max, plotSizeBounds.min, plotSizeBounds.max]);

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

      {/* Instructions Overlay */}
      {showInstructions && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto'
          }}
        >
          <div
            style={{
              background: 'rgba(20,20,20,0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: `${instructionsUi.padding}px`,
              maxWidth: `${instructionsUi.maxWidth}px`,
              width: '90vw',
              color: '#ffffff',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(6,182,212,0.4), 0 0 30px rgba(6,182,212,0.3)',
              animation: 'filterGlow 2s ease-in-out infinite'
            }}
          >
            <h2 style={{ fontSize: instructionsUi.title, fontWeight: 700, marginBottom: 16, color: '#06b6d4' }}>
              Welcome to Subishi Serenity
            </h2>
            
            <div style={{ fontSize: instructionsUi.body, lineHeight: 1.6, marginBottom: 24, color: '#D1D5DB' }}>
              {containerSize.width >= 768 ? (
                <>
                  <p style={{ marginBottom: 16 }}>
                    Hover or click on any villa to view detailed information
                  </p>
                  
                  <p style={{ marginBottom: 16 }}>
                    Use the <strong style={{ color: '#06b6d4' }}>filter</strong> button in the <strong style={{ color: '#ffffff' }}>top-right</strong> corner
                  </p>
                  
                  <p>
                    Drag to pan and scroll to zoom
                  </p>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: 12 }}>
                    <strong style={{ color: '#ffffff' }}>Tap villas</strong> for details.
                  </p>
                  
                  <p>
                    Use <strong style={{ color: '#06b6d4' }}>filter</strong> to search.
                  </p>
                </>
              )}
            </div>
            
            <button
              onClick={() => setShowInstructions(false)}
              style={{
                background: '#06b6d4',
                color: '#000000',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                fontSize: instructionsUi.button,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Ubuntu, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#0891b2';
                e.target.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#06b6d4';
                e.target.style.transform = 'scale(1)';
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Outer-layer UI via portal with padded position */}
      <UILayerPortal>
        {/* Use pure inline styles to avoid any utility class conflicts */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
          {/* Button */}
          {/* Hover swap: icon-only -> expanded button in same position */}
          <div
            ref={filterBtnRef}
            onMouseEnter={() => setIsFilterHover(true)}
            onMouseLeave={() => setIsFilterHover(false)}
            style={{ position: 'fixed', top: 24, right: 24, pointerEvents: 'auto', height: 36 }}
          >
            <AnimatePresence initial={false}>
              {!(isFilterHover || (filtersApplied && !showFilters)) && (
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
                    background: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    color: '#000000',
                    width: btnUi.btn,
                    height: btnUi.btn,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(6,182,212,0.4), 0 0 20px rgba(6,182,212,0.3)',
                    cursor: 'pointer',
                    animation: 'filterGlow 2s ease-in-out infinite'
                  }}
                >
                  <svg width={btnUi.icon} height={btnUi.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="#000000"/>
                  </svg>
                </motion.button>
              )}
              {(isFilterHover || (filtersApplied && !showFilters)) && (
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
                    background: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    color: '#000000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: btnUi.gap,
                    padding: `0px ${btnUi.padX}px`,
                    height: btnUi.btn,
                    maxWidth: 'min(70vw, 520px)',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(6,182,212,0.4), 0 0 20px rgba(6,182,212,0.3)',
                    cursor: 'pointer',
                    animation: 'filterGlow 2s ease-in-out infinite'
                  }}
                >
                  <svg width={btnUi.icon} height={btnUi.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="#000000"/>
                  </svg>
                  {filtersApplied ? (
                    <>
                      <span style={{ color: '#000000', fontWeight: 600 }}> = </span>
                      {filterSummaryContent}
                    </>
                  ) : (
                    <span style={{ fontSize: btnUi.font, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'Ubuntu, sans-serif' }}>Filter</span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Panel */}
          {showFilters && (
            <div
              ref={panelRef}
              style={{
                position: 'fixed',
                top: 24 + btnUi.btn + 12,
                right: 16,
                background: 'rgba(20,20,20,0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.55)',
                pointerEvents: 'auto',
                padding: filterPanelUi.padding,
                width: `min(${filterPanelUi.width}px, 85vw)`,
                maxHeight: '50vh',
                overflow: 'hidden auto'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: 10 
              }}>
                <div style={{ fontSize: filterPanelUi.fontSize, fontWeight: 700, letterSpacing: 0.2, fontFamily: 'Ubuntu, sans-serif' }}>Villa Filters</div>
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
                    padding: `${Math.max(4, filterPanelUi.buttonSize - 2)}px ${Math.max(8, filterPanelUi.buttonSize + 2)}px`,
                    borderRadius: 6,
                    fontSize: filterPanelUi.buttonSize,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Ubuntu, sans-serif'
                  }}
                >
                  Clear
                </div>
              </div>
              {/* Availability */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: filterPanelUi.fontSize - 1, color: '#D1D5DB', marginBottom: 6, fontFamily: 'Ubuntu, sans-serif' }}>Availability</div>
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
                        padding: `${Math.max(4, filterPanelUi.buttonSize - 2)}px ${Math.max(6, filterPanelUi.buttonSize)}px`,
                        borderRadius: 8,
                        fontSize: filterPanelUi.buttonSize,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Ubuntu, sans-serif'
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
                <div style={{ fontSize: filterPanelUi.fontSize - 1, color: '#D1D5DB', marginBottom: 6, fontFamily: 'Ubuntu, sans-serif' }}>Facing</div>
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
                        padding: `${Math.max(4, filterPanelUi.buttonSize - 2)}px ${Math.max(6, filterPanelUi.buttonSize)}px`,
                        borderRadius: 8,
                        fontSize: filterPanelUi.buttonSize,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: filters.facing?.has(f) ? '0 0 0 2px #10b981 inset' : 'none',
                        fontFamily: 'Ubuntu, sans-serif'
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
                <div style={{ fontSize: filterPanelUi.fontSize - 1, color: '#D1D5DB', marginBottom: 6, fontFamily: 'Ubuntu, sans-serif' }}>Sq. Ft</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: filterPanelUi.fontSize - 1, color: '#D1D5DB', marginBottom: 6, fontFamily: 'Ubuntu, sans-serif' }}>
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
                <div style={{ fontSize: filterPanelUi.fontSize - 1, color: '#D1D5DB', marginBottom: 6, fontFamily: 'Ubuntu, sans-serif' }}>Plot Size (SqYds)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: filterPanelUi.fontSize - 1, color: '#D1D5DB', marginBottom: 6, fontFamily: 'Ubuntu, sans-serif' }}>
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

            </div>
          )}
        </div>
      </UILayerPortal>

    </div>
  );
}