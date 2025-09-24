"use client";

import React, { useMemo } from 'react';

export function VirtualizedPlots({ 
  plots, 
  viewBox, 
  currentZoom, 
  onPlotHover, 
  activePlotId 
}) {
  // For now, we'll render all plots (virtualization can be added later for performance)
  const highlightedIds = useMemo(() => {
    if (!activePlotId) return new Set();
    
    // Find the active plot
    const activePlot = plots.find(p => p.id === activePlotId);
    if (!activePlot) return new Set([activePlotId]);
    
    // If it's a canal, highlight all canal plots
    if (activePlot.plotType === 'canal') {
      return new Set(plots.filter(p => p.plotType === 'canal').map(p => p.id));
    }
    
    return new Set([activePlotId]);
  }, [activePlotId, plots]);

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%' 
      }}
    >
      <g>
        {plots.map((plot) => {
          const isHighlighted = highlightedIds.has(plot.id);
          return (
            <polygon
              key={plot.id}
              points={plot.points}
              style={{
                fill: isHighlighted ? plot.color : 'transparent',
                stroke: isHighlighted ? 'white' : 'rgba(255, 255, 255, 0.2)',
                strokeWidth: isHighlighted ? 2 : 1,
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
              onMouseEnter={() => onPlotHover(plot)}
            />
          );
        })}
      </g>
    </svg>
  );
}
