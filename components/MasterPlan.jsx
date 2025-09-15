"use client";

import React, { useMemo, useState } from "react";
import { extractVillaKey } from "./idUtil";

// Define our color palette, now including highlight colors for special zones
const COLOR_MAP = {
  // Villa status colors
  "Available": "rgba(0, 255, 255, 0.6)",
  "Hold": "rgba(255, 255, 0, 0.6)",
  "Sold": "rgba(255, 0, 0, 0.6)",
  // Special zone highlight colors
  "ClubhouseHighlight": "rgba(168, 85, 247, 0.7)", // A distinct purple
  "CanalHighlight": "rgba(59, 130, 246, 0.7)",      // A nice blue
};

// This helper function now handles titles for all plot types
function titleForPlot(plot) {
  if (!plot) return "";
  if (plot.plotType === 'clubhouse') return "Clubhouse";
  if (plot.plotType === 'canal') return "Canal/Landscaping Zone";
  
  const k = extractVillaKey(plot.id);
  return k ? `Villa No. ${k}` : plot.id.replace(/_/g, " ");
}

export default function MasterPlan({ mapData, sheetRows = [] }) {
  const [activePlot, setActivePlot] = useState(null);
  
  const byKey = useMemo(() => {
    const m = new Map();
    for (const r of sheetRows) {
      const key = extractVillaKey(r.id);
      if (key) {
        m.set(key, r);
      }
    }
    return m;
  }, [sheetRows]);

  // This is the core logic update. We now process every plot from the JSON
  // and enrich it with its type, data, and highlight color.
  const derivedPlots = useMemo(() => {
    if (!mapData.plots) return [];
    
    return mapData.plots.map(plot => {
      const id = plot.id;
      let plotType = 'villa'; // Assume it's a villa by default
      let color = 'transparent';

      // Categorize the plot based on its ID
      if (/CLUBHOUSE/i.test(id)) {
        plotType = 'clubhouse';
        color = COLOR_MAP.ClubhouseHighlight;
      } else if (/CANAL|LANDSCAPE/i.test(id)) {
        plotType = 'canal';
        color = COLOR_MAP.CanalHighlight;
      } else {
        // It's a villa, so get its data and color from the sheet
        const key = extractVillaKey(id);
        const sheetData = key ? byKey.get(key) : null;
        const availability = sheetData?.availability || "Available";
        color = COLOR_MAP[availability] || 'transparent';

        return { ...plot, plotType, sheetData, color, availability };
      }

      // Return the enriched object for special zones
      return { ...plot, plotType, color, sheetData: null };
    });
  }, [mapData, byKey]);

  // This new memo hook calculates which plot IDs should be highlighted.
  // This is the key to group highlighting.
  const highlightedIds = useMemo(() => {
    if (!activePlot) return new Set(); // If nothing is hovered, highlight nothing

    // If the hovered plot is a canal, find ALL canal plots and return their IDs
    if (activePlot.plotType === 'canal') {
      const canalIds = derivedPlots
        .filter(p => p.plotType === 'canal')
        .map(p => p.id);
      return new Set(canalIds);
    }

    // Otherwise, just highlight the single active plot (villa or clubhouse)
    return new Set([activePlot.id]);
  }, [activePlot, derivedPlots]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0a" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        <img
          src="/BaseLayer-small.png"
          alt="Master Plan"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        <svg
          viewBox={mapData.viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          onMouseLeave={() => setActivePlot(null)}
        >
          <g>
            {derivedPlots.map((plot) => {
              // A plot is highlighted if its ID is in our 'highlightedIds' set
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
                    transition: 'fill 0.15s ease, stroke 0.15s ease',
                  }}
                  onMouseEnter={() => setActivePlot(plot)}
                />
              );
            })}
          </g>
        </svg>

        {/* The info box now appears for ANY active plot, not just those with sheet data */}
        {activePlot && (
          <div style={{ position: "absolute", left: 16, bottom: 16, background: "rgba(0,0,0,0.8)", padding: 16, borderRadius: 10, color: "#fff", fontFamily: "sans-serif" }}>
            <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 8 }}>{titleForPlot(activePlot)}</div>
            
            {/* Conditionally render villa details ONLY if the plot is a villa */}
            {activePlot.plotType === 'villa' && activePlot.sheetData && (
              <>
                <div style={{ marginBottom: '4px' }}>
                  <strong>Status:</strong> 
                  <span style={{ color: activePlot.color, paddingLeft: '8px', fontWeight: 'bold' }}>
                    {activePlot.availability}
                  </span>
                </div>
                {activePlot.sheetData.facing && <div><strong>Facing:</strong> {activePlot.sheetData.facing}</div>}
                {activePlot.sheetData.sqft && <div><strong>SQFT:</strong> {activePlot.sheetData.sqft}</div>}
                {activePlot.sheetData.plotSize && <div><strong>Plot Size (SqYds):</strong> {activePlot.sheetData.plotSize}</div>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}