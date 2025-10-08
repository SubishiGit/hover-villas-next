"use client";

import React, { useMemo } from 'react';

export function VirtualizedPlots({ 
  plots, 
  viewBox, 
  currentZoom, 
  onPlotHover, 
  onPlotLeave,
  activePlotId,
  matchedPlotIds, // optional Set<string> of plot ids matching filters
  hasActiveFilters = false
}) {
  // Determine which plots to highlight based on filters and hover state
  const highlightedIds = useMemo(() => {
    const highlighted = new Set();
    
    // Highlight filter matches when active
    if (hasActiveFilters && matchedPlotIds && matchedPlotIds.size > 0) {
      matchedPlotIds.forEach(id => highlighted.add(id));
    }
    
    // Always highlight the actively hovered/active plot
    if (activePlotId) {
      const activePlot = plots.find(p => p.id === activePlotId);
      if (activePlot) {
        highlighted.add(activePlotId);
        // If it's a canal, highlight all canal plots
        if (activePlot.plotType === 'canal') {
          plots.filter(p => p.plotType === 'canal').forEach(p => highlighted.add(p.id));
        }
      }
    }
    
    return highlighted;
  }, [activePlotId, plots, hasActiveFilters, matchedPlotIds]);

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
      onMouseLeave={onPlotLeave}
    >
      <g>
        {plots.map((plot) => {
          const isHighlighted = highlightedIds.has(plot.id);
          const isHovered = activePlotId === plot.id;
          
          // Determine fill and opacity based on filter state
          let fill = 'transparent';
          let opacity = 1;
          let stroke = 'rgba(255, 255, 255, 0.2)';
          let strokeWidth = 1;
          
          if (isHighlighted) {
            fill = plot.color;
            stroke = 'white';
            strokeWidth = 2;
          }
          
          // If hovered, always show full opacity and color
          if (isHovered) {
            fill = plot.color;
            opacity = 1;
            stroke = 'white';
            strokeWidth = 2;
          }
          
          return (
            <polygon
              key={plot.id}
              points={plot.points}
              style={{
                fill: fill,
                stroke: stroke,
                strokeWidth: strokeWidth,
                opacity: opacity,
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
              onMouseEnter={() => onPlotHover(plot)}
              onMouseLeave={onPlotLeave}
            />
          );
        })}
      </g>
    </svg>
  );
}
