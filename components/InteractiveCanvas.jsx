"use client";

import React, { useRef, useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomInIcon, ZoomOutIcon, FitIcon, ResetIcon } from './Icons';

export function InteractiveCanvas({ 
  children, 
  minZoom = 0.1, 
  maxZoom = 10, 
  initialZoom = 1,
  onZoomChange
}) {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Custom controls component
  const Controls = () => {
    const { zoomIn, zoomOut, resetTransform, centerView } = useControls();
    
    return (
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <button 
          onClick={() => zoomIn(0.3)} 
          className="control-btn" 
          aria-label="Zoom in"
        >
          <ZoomInIcon />
        </button>
        <button 
          onClick={() => zoomOut(0.3)} 
          className="control-btn" 
          aria-label="Zoom out"
        >
          <ZoomOutIcon />
        </button>
        <button 
          onClick={() => centerView()} 
          className="control-btn" 
          aria-label="Center view"
        >
          <FitIcon />
        </button>
        <button 
          onClick={() => resetTransform()} 
          className="control-btn" 
          aria-label="Reset view"
        >
          <ResetIcon />
        </button>
      </div>
    );
  };

  // Handle zoom change callbacks
  const handleTransformChange = (ref, state) => {
    if (onZoomChange) {
      onZoomChange(state.scale);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <TransformWrapper
        initialScale={initialZoom}
        minScale={minZoom}
        maxScale={maxZoom}
        centerZoomedOut={true}
        centerOnInit={true}
        wheel={{
          step: 0.3, // Match button zoom step
          smoothStep: 0.01,
          activationKeys: [],
          touchPadDisabled: false,
          excluded: [],
        }}
        pinch={{
          step: 0.3, // Match button zoom step
          disabled: false,
          excluded: [],
        }}
        pan={{
          disabled: false,
          velocityDisabled: false,
          lockAxisX: false,
          lockAxisY: false,
          limitToBounds: true, // Prevent image from going completely off-screen
          padding: isMobile ? 100 : 200, // Allow good range but keep some content visible
        }}
        doubleClick={{
          disabled: true, // Disable double-click zoom to prevent conflicts
        }}
        onTransformed={handleTransformChange}
        limitToBounds={true}
        boundaryFriction={0.2}
        alignmentAnimation={{
          disabled: false,
          sizeX: 0,
          sizeY: 0,
          velocityAlignmentTime: 0.2,
        }}
        velocityAnimation={{
          disabled: false,
          equalToMove: true,
          animationTime: 0.3,
          animationType: 'easeOut',
        }}
        smooth={true}
        smoothTime={0.3}
        transformEnabled={true}
        panning={{
          disabled: false,
          wheelPanning: false,
          excluded: [],
        }}
        zoomAnimation={{
          disabled: false,
          size: 0.2,
          animationTime: 0.3,
          animationType: 'easeOut',
        }}
        disablePadding={false}
      >
        <Controls />
        <TransformComponent
          wrapperClass="w-full h-full"
          contentClass="w-full h-full flex items-center justify-center"
          wrapperStyle={{
            width: '100%',
            height: '100%',
            cursor: 'grab',
          }}
          contentStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}