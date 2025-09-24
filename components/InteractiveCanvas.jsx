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
    onPinch: ({ offset: [pinchScale], origin: [ox, oy], movement: [mx, my], memo }) => {
      if (!memo) {
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
      
      // Calculate gesture center movement (article's insight)
      const centerDeltaX = ox - memo.centerX;
      const centerDeltaY = oy - memo.centerY;
      
      const newScale = Math.max(minZoom, Math.min(maxZoom, Number(pinchScale) || memo.scale || 1));
      const scaleRatio = newScale / (memo.scale || 1);
      
      // Apply coordinate transformation from article
      // Offset After = Offset Before + (Scale Before * Content Coordinate) - (Scale After * Content Coordinate)
      const contentX = (ox - rect.width / 2 - memo.x) / memo.scale;
      const contentY = (oy - rect.height / 2 - memo.y) / memo.scale;
      
      const newX = memo.x + (memo.scale * contentX) - (newScale * contentX) + centerDeltaX;
      const newY = memo.y + (memo.scale * contentY) - (newScale * contentY) + centerDeltaY;
      
      // Apply bounds checking
      const smart = calculateBounds(newScale);
      let boundedX = newX, boundedY = newY;
      if (smart) {
        boundedX = Math.max(smart.left, Math.min(smart.right, newX));
        boundedY = Math.max(smart.top, Math.min(smart.bottom, newY));
      }
      
      api.start({ scale: newScale, x: boundedX, y: boundedY });
      
      // Update memo for next iteration
      memo.centerX = ox;
      memo.centerY = oy;
      
      return memo;
    }
  }, {
    drag: { 
      threshold: 3, // Lower threshold for more responsive dragging
      filterTaps: true,
      rubberband: 0.1, // Gentle rubberband for better UX
      bounds: () => calculateBounds(Number(scale.get() ?? initialZoom))
    },
    pinch: { 
      threshold: 0.05, // More sensitive pinch detection
      scaleBounds: { min: minZoom, max: maxZoom },
      rubberband: 0.1
    }
  });

  // Mouse-centered zoom implementation based on article's coordinate transformation
  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // Get mouse position relative to container
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Get current transform state
      const currentScale = Number(scale.get() ?? initialZoom);
      const currentX = Number(x.get() ?? 0);
      const currentY = Number(y.get() ?? 0);
      
      // Calculate new scale
      const intensity = event.ctrlKey ? 0.002 : 0.001;
      const newScale = Math.max(minZoom, Math.min(maxZoom, currentScale - event.deltaY * intensity));
      
      if (newScale === currentScale) return; // No change needed
      
      // Article's coordinate transformation:
      // Offset After = Offset Before + (Scale Before * Content Coordinate) - (Scale After * Content Coordinate)
      
      // Calculate content coordinate (mouse position in content space)
      const contentX = (mouseX - rect.width / 2 - currentX) / currentScale;
      const contentY = (mouseY - rect.height / 2 - currentY) / currentScale;
      
      // Apply transformation
      const newX = currentX + (currentScale * contentX) - (newScale * contentX);
      const newY = currentY + (currentScale * contentY) - (newScale * contentY);
      
      // Apply bounds checking
      const smart = calculateBounds(newScale);
      let boundedX = newX, boundedY = newY;
      if (smart) {
        boundedX = Math.max(smart.left, Math.min(smart.right, newX));
        boundedY = Math.max(smart.top, Math.min(smart.bottom, newY));
      }
      
      api.start({ scale: newScale, x: boundedX, y: boundedY });
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
    zoomIn: (factor = 1.5, centerPoint = null) => {
      const current = Number(scale.get() ?? initialZoom);
      const newScale = Math.min(maxZoom, current * factor);
      
      if (centerPoint) {
        // Use provided center point (e.g., for button clicks at screen center)
        const currentX = Number(x.get() ?? 0);
        const currentY = Number(y.get() ?? 0);
        const { width, height } = containerBounds;
        
        const contentX = (centerPoint.x - width / 2 - currentX) / current;
        const contentY = (centerPoint.y - height / 2 - currentY) / current;
        
        const newX = currentX + (current * contentX) - (newScale * contentX);
        const newY = currentY + (current * contentY) - (newScale * contentY);
        
        api.start({ scale: newScale, x: newX, y: newY });
      } else {
        // Default: zoom to center
        api.start({ scale: Number.isFinite(newScale) ? newScale : initialZoom });
      }
    },
    zoomOut: (factor = 1.5, centerPoint = null) => {
      const current = Number(scale.get() ?? initialZoom);
      const newScale = Math.max(minZoom, current / factor);
      
      if (centerPoint) {
        // Use provided center point
        const currentX = Number(x.get() ?? 0);
        const currentY = Number(y.get() ?? 0);
        const { width, height } = containerBounds;
        
        const contentX = (centerPoint.x - width / 2 - currentX) / current;
        const contentY = (centerPoint.y - height / 2 - currentY) / current;
        
        const newX = currentX + (current * contentX) - (newScale * contentX);
        const newY = currentY + (current * contentY) - (newScale * contentY);
        
        api.start({ scale: newScale, x: newX, y: newY });
      } else {
        // Default: zoom from center
        api.start({ scale: Number.isFinite(newScale) ? newScale : initialZoom });
      }
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