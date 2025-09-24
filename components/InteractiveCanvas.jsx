"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { animated, useSpring, to } from '@react-spring/web';
import { ZoomInIcon, ZoomOutIcon, FitIcon, ResetIcon } from './Icons';

export function InteractiveCanvas({ 
  children, 
  minZoom = 0.1, 
  maxZoom = 10, 
  initialZoom = 1,
  bounds = 'auto'
}) {
  const containerRef = useRef();
  const animatedRef = useRef();
  const [containerBounds, setContainerBounds] = useState({ width: 0, height: 0 });

  const [{ x, y, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: initialZoom,
    config: { tension: 300, friction: 30, precision: 0.01 }
  }));

  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerBounds({ width: rect.width, height: rect.height });
      }
    };
    updateBounds();
    window.addEventListener('resize', updateBounds, { passive: true });
    return () => window.removeEventListener('resize', updateBounds);
  }, []);

  const calculateBounds = useCallback((currentScale) => {
    const s = Number.isFinite(currentScale) ? currentScale : 1;
    if (bounds === 'auto' && containerBounds.width > 0 && containerBounds.height > 0) {
      const scaledWidth = containerBounds.width * s;
      const scaledHeight = containerBounds.height * s;
      return {
        left: Math.min(0, containerBounds.width - scaledWidth),
        right: Math.max(0, scaledWidth - containerBounds.width),
        top: Math.min(0, containerBounds.height - scaledHeight),
        bottom: Math.max(0, scaledHeight - containerBounds.height)
      };
    }
    return bounds;
  }, [bounds, containerBounds]);

  const bind = useGesture({
    onDrag: ({ offset: [dx, dy] }) => {
      const currentScale = Number(scale.get() ?? initialZoom);
      const smart = calculateBounds(currentScale);
      let nx = dx, ny = dy;
      if (smart) {
        nx = Math.max(smart.left, Math.min(smart.right, nx));
        ny = Math.max(smart.top, Math.min(smart.bottom, ny));
      }
      api.start({ x: nx, y: ny });
    },
    onPinch: ({ offset: [pinchScale], origin: [ox, oy], memo }) => {
      if (!memo) {
        memo = { x: Number(x.get() ?? 0), y: Number(y.get() ?? 0), scale: Number(scale.get() ?? initialZoom) };
      }
      const newScale = Math.max(minZoom, Math.min(maxZoom, Number(pinchScale) || memo.scale || 1));
      const deltaScale = newScale / (memo.scale || 1);

      const rect = containerRef.current?.getBoundingClientRect();
      const centerX = rect ? rect.width / 2 : 0;
      const centerY = rect ? rect.height / 2 : 0;
      const deltaX = (ox - centerX) * (deltaScale - 1);
      const deltaY = (oy - centerY) * (deltaScale - 1);

      api.start({
        scale: newScale,
        x: memo.x - deltaX,
        y: memo.y - deltaY
      });
      return memo;
    }
  }, {
    drag: { threshold: 5 },
    pinch: { threshold: 0.1 }
  });

  // Handle wheel events with proper passive: false, attached early to capture phase
  useEffect(() => {
    const handleWheel = (event) => {
      // Stop the event from reaching React's event system
      event.stopPropagation();
      event.preventDefault();
      
      const current = Number(scale.get() ?? initialZoom);
      const intensity = event.ctrlKey ? 0.002 : 0.001;
      const next = Math.max(minZoom, Math.min(maxZoom, current - event.deltaY * intensity));
      api.start({ scale: next });
    };

    const element = containerRef.current;
    if (element) {
      // Add listener in capture phase to intercept before React's synthetic events
      element.addEventListener('wheel', handleWheel, { 
        passive: false, 
        capture: true 
      });
      
      return () => {
        element.removeEventListener('wheel', handleWheel, { 
          capture: true 
        });
      };
    }
  }, [scale, api, minZoom, maxZoom, initialZoom]);

  // Also add a backup wheel handler to the document if the container method fails
  useEffect(() => {
    const handleDocumentWheel = (event) => {
      // Only handle if the event target is within our container
      if (containerRef.current && containerRef.current.contains(event.target)) {
        event.stopPropagation();
        event.preventDefault();
        
        const current = Number(scale.get() ?? initialZoom);
        const intensity = event.ctrlKey ? 0.002 : 0.001;
        const next = Math.max(minZoom, Math.min(maxZoom, current - event.deltaY * intensity));
        api.start({ scale: next });
      }
    };

    // Add to document with capture to override React's handling
    document.addEventListener('wheel', handleDocumentWheel, { 
      passive: false, 
      capture: true 
    });

    return () => {
      document.removeEventListener('wheel', handleDocumentWheel, { 
        capture: true 
      });
    };
  }, [scale, api, minZoom, maxZoom, initialZoom]);

  const controls = {
    zoomIn: (factor = 1.5) => {
      const current = Number(scale.get() ?? initialZoom);
      const next = Math.min(maxZoom, current * factor);
      api.start({ scale: Number.isFinite(next) ? next : initialZoom });
    },
    zoomOut: (factor = 1.5) => {
      const current = Number(scale.get() ?? initialZoom);
      const next = Math.max(minZoom, current / factor);
      api.start({ scale: Number.isFinite(next) ? next : initialZoom });
    },
    reset: () => {
      api.start({ x: 0, y: 0, scale: initialZoom });
    },
    fitToView: () => {
      const { width, height } = containerBounds;
      if (!width || !height) return;
      const optimal = Math.min(width / 1000, height / 600);
      const safe = Number.isFinite(optimal) && optimal > 0 ? optimal : 1;
      api.start({ x: 0, y: 0, scale: safe });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ userSelect: 'none', touchAction: 'none' }}
    >
      <animated.div
        ref={animatedRef}
        {...bind()}
        style={{
          transform: to([x, y, scale], (tx, ty, s) => `translate3d(${tx}px, ${ty}px, 0) scale(${s})`),
          transformOrigin: 'center center',
          width: '100%',
          height: '100%',
          cursor: 'grab',
          willChange: 'transform',
          touchAction: 'none'
        }}
        onMouseDown={(e) => { e.currentTarget.style.cursor = 'grabbing'; }}
        onMouseUp={(e) => { e.currentTarget.style.cursor = 'grab'; }}
        onWheel={(e) => {
          // Prevent React's synthetic event system from handling this
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </animated.div>

      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <button onClick={controls.zoomIn} className="control-btn" aria-label="Zoom in"><ZoomInIcon /></button>
        <button onClick={controls.zoomOut} className="control-btn" aria-label="Zoom out"><ZoomOutIcon /></button>
        <button onClick={controls.fitToView} className="control-btn" aria-label="Fit to view"><ResetIcon /></button>
        <button onClick={controls.reset} className="control-btn" aria-label="Reset view"><FitIcon /></button>
      </div>
    </div>
  );
}