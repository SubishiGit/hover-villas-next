"use client";

import React, { useRef, useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
// Removed on-screen control icons per request

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

  // Controls removed: keep gestures and programmatic control only

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
        initialPositionX={0}
        initialPositionY={0}
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
          limitToBounds: false, // Remove bounds to test fundamental issue
          padding: 0, // Remove padding to isolate the core problem
        }}
        doubleClick={{
          disabled: true, // Disable double-click zoom to prevent conflicts
        }}
        onTransformed={handleTransformChange}
        limitToBounds={false}
        boundaryFriction={0}
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
        {/* Controls removed */}
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