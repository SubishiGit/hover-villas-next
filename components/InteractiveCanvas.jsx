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
  bounds = 'auto',
  onZoomChange
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
  
  // Track zoom changes using a separate state
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  
  // Monitor scale changes and notify parent
  useEffect(() => {
    const checkZoomChange = () => {
      const newZoom = Number(scale.get());
      if (Math.abs(newZoom - currentZoom) > 0.01) {
        setCurrentZoom(newZoom);
        if (onZoomChange) {
          onZoomChange(newZoom);
        }
      }
    };
    
    const interval = setInterval(checkZoomChange, 100);
    return () => clearInterval(interval);
  }, [scale, currentZoom, onZoomChange]);

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
      // Allow more generous scrolling bounds for better mobile experience
      const scaledWidth = containerBounds.width * s;
      const scaledHeight = containerBounds.height * s;
      const extraMargin = Math.min(containerBounds.width, containerBounds.height) * 0.1; // 10% margin
      
      return {
        left: Math.min(-extraMargin, containerBounds.width - scaledWidth - extraMargin),
        right: Math.max(extraMargin, scaledWidth - containerBounds.width + extraMargin),
        top: Math.min(-extraMargin, containerBounds.height - scaledHeight - extraMargin),
        bottom: Math.max(extraMargin, scaledHeight - containerBounds.height + extraMargin)
      };
    }
    return bounds;
  }, [bounds, containerBounds]);

  const bind = useGesture({
    onDrag: ({ offset: [dx, dy], active }) => {
      const currentScale = Number(scale.get() ?? initialZoom);
      const smart = calculateBounds(currentScale);
      let nx = dx, ny = dy;
      if (smart) {
        nx = Math.max(smart.left, Math.min(smart.right, nx));
        ny = Math.max(smart.top, Math.min(smart.bottom, ny));
      }
      api.start({ 
        x: nx, 
        y: ny,
        immediate: active, // Immediate updates while dragging for responsiveness
        config: active ? { tension: 400, friction: 40 } : { tension: 300, friction: 30 }
      });
    },
    onPinch: ({ offset: [d, a], origin: [ox, oy], first, memo }) => {
      if (first || !memo) {
        memo = { 
          x: Number(x.get() ?? 0), 
          y: Number(y.get() ?? 0), 
          scale: Number(scale.get() ?? initialZoom),
          centerX: ox,
          centerY: oy
        };
      }
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return memo;
      
      // Calculate gesture center movement
      const centerDeltaX = ox - memo.centerX;
      const centerDeltaY = oy - memo.centerY;
      
      // Simple fix: invert the pinch scale value
      // If d > 1, it means fingers moved apart, so zoom in
      // If d < 1, it means fingers moved together, so zoom out
      const newScale = Math.max(minZoom, Math.min(maxZoom, memo.scale * d));
      
      // Enhanced coordinate transformation with center tracking
      const scaleRatio = newScale / memo.scale;
      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;
      
      // Apply precise transformation accounting for gesture center movement
      const newX = memo.x + (ox - containerCenterX) * (1 - scaleRatio) + centerDeltaX;
      const newY = memo.y + (oy - containerCenterY) * (1 - scaleRatio) + centerDeltaY;
      
      // Apply bounds checking
      const smart = calculateBounds(newScale);
      let boundedX = newX, boundedY = newY;
      if (smart) {
        boundedX = Math.max(smart.left, Math.min(smart.right, newX));
        boundedY = Math.max(smart.top, Math.min(smart.bottom, newY));
      }
      
      api.start({ 
        scale: newScale, 
        x: boundedX, 
        y: boundedY,
        config: { tension: 350, friction: 30 }
      });
      
      // Update memo for next iteration
      memo.centerX = ox;
      memo.centerY = oy;
      
      return memo;
    }
  }, {
    drag: { 
      threshold: 5, // Slightly higher to prevent conflict with pinch
      filterTaps: true,
      rubberband: 0.1,
      bounds: () => calculateBounds(Number(scale.get() ?? initialZoom))
    },
    pinch: { 
      threshold: 0.05,
      scaleBounds: { min: minZoom, max: maxZoom },
      rubberband: 0.1
    }
  });

  // Enhanced mouse-centered zoom with better precision
  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // Get precise mouse position relative to container
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Get current transform state with higher precision
      const currentScale = Number(scale.get() ?? initialZoom);
      const currentX = Number(x.get() ?? 0);
      const currentY = Number(y.get() ?? 0);
      
      // More precise zoom calculation with variable intensity
      let intensity;
      if (event.ctrlKey || event.metaKey) {
        intensity = 0.005; // Faster zoom with modifier keys
      } else {
        // Adaptive intensity based on current zoom level
        intensity = Math.max(0.0008, Math.min(0.003, 0.001 * (1 + currentScale * 0.5)));
      }
      
      const deltaScale = -event.deltaY * intensity;
      const newScale = Math.max(minZoom, Math.min(maxZoom, currentScale + deltaScale));
      
      if (Math.abs(newScale - currentScale) < 0.001) return; // Prevent micro-changes
      
      // High-precision coordinate transformation
      // Calculate exact content coordinate under mouse
      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;
      
      // Content coordinate = (mouse position - container center - current offset) / current scale
      const contentX = (mouseX - containerCenterX - currentX) / currentScale;
      const contentY = (mouseY - containerCenterY - currentY) / currentScale;
      
      // Apply precise transformation
      const scaleRatio = newScale / currentScale;
      const newX = currentX + (mouseX - containerCenterX) * (1 - scaleRatio);
      const newY = currentY + (mouseY - containerCenterY) * (1 - scaleRatio);
      
      // Apply bounds checking
      const smart = calculateBounds(newScale);
      let boundedX = newX, boundedY = newY;
      if (smart) {
        boundedX = Math.max(smart.left, Math.min(smart.right, newX));
        boundedY = Math.max(smart.top, Math.min(smart.bottom, newY));
      }
      
      // Smooth animation with precise config
      api.start({ 
        scale: newScale, 
        x: boundedX, 
        y: boundedY,
        config: { tension: 400, friction: 35, precision: 0.0001 }
      });
    };

    const element = containerRef.current;
    if (element) {
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
  }, [scale, x, y, api, minZoom, maxZoom, initialZoom, calculateBounds]);

  const controls = {
    zoomIn: (factor = 1.3, centerPoint = null) => {
      const current = Number(scale.get() ?? initialZoom);
      const newScale = Math.min(maxZoom, current * factor);
      
      if (centerPoint) {
        // Use provided center point with precise transformation
        const currentX = Number(x.get() ?? 0);
        const currentY = Number(y.get() ?? 0);
        const { width, height } = containerBounds;
        
        const scaleRatio = newScale / current;
        const newX = currentX + (centerPoint.x - width / 2) * (1 - scaleRatio);
        const newY = currentY + (centerPoint.y - height / 2) * (1 - scaleRatio);
        
        // Apply bounds
        const smart = calculateBounds(newScale);
        let boundedX = newX, boundedY = newY;
        if (smart) {
          boundedX = Math.max(smart.left, Math.min(smart.right, newX));
          boundedY = Math.max(smart.top, Math.min(smart.bottom, newY));
        }
        
        api.start({ 
          scale: newScale, 
          x: boundedX, 
          y: boundedY,
          config: { tension: 300, friction: 30 }
        });
      } else {
        // Default: zoom to center
        api.start({ 
          scale: Number.isFinite(newScale) ? newScale : initialZoom,
          config: { tension: 300, friction: 30 }
        });
      }
    },
    zoomOut: (factor = 1.3, centerPoint = null) => {
      const current = Number(scale.get() ?? initialZoom);
      const newScale = Math.max(minZoom, current / factor);
      
      if (centerPoint) {
        // Use provided center point with precise transformation
        const currentX = Number(x.get() ?? 0);
        const currentY = Number(y.get() ?? 0);
        const { width, height } = containerBounds;
        
        const scaleRatio = newScale / current;
        const newX = currentX + (centerPoint.x - width / 2) * (1 - scaleRatio);
        const newY = currentY + (centerPoint.y - height / 2) * (1 - scaleRatio);
        
        // Apply bounds
        const smart = calculateBounds(newScale);
        let boundedX = newX, boundedY = newY;
        if (smart) {
          boundedX = Math.max(smart.left, Math.min(smart.right, newX));
          boundedY = Math.max(smart.top, Math.min(smart.bottom, newY));
        }
        
        api.start({ 
          scale: newScale, 
          x: boundedX, 
          y: boundedY,
          config: { tension: 300, friction: 30 }
        });
      } else {
        // Default: zoom from center
        api.start({ 
          scale: Number.isFinite(newScale) ? newScale : initialZoom,
          config: { tension: 300, friction: 30 }
        });
      }
    },
    reset: () => {
      api.start({ 
        x: 0, 
        y: 0, 
        scale: initialZoom,
        config: { tension: 250, friction: 25 }
      });
    },
    fitToView: () => {
      const { width, height } = containerBounds;
      if (!width || !height) return;
      const optimal = Math.min(width / 1000, height / 600);
      const safe = Number.isFinite(optimal) && optimal > 0 ? optimal : 1;
      api.start({ 
        x: 0, 
        y: 0, 
        scale: safe,
        config: { tension: 250, friction: 25 }
      });
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
          transformOrigin: '50% 50%', // More explicit than 'center center'
          width: '100%',
          height: '100%',
          cursor: 'grab',
          willChange: 'transform',
          touchAction: 'none',
          // Better mobile performance
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden'
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