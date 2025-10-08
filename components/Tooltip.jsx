"use client";

import React, { useRef, useLayoutEffect, useState } from "react";
import { motion } from "framer-motion";

function titleForPlot(plot) {
  if (plot.plotType === 'clubhouse') return "Clubhouse";
  if (plot.plotType === 'canal') return "Canal / Landscaping Zone";
  const villaKey = plot.id.match(/[0-9]+[A-Z]?/)?.[0] || plot.id;
  return `Villa No. ${villaKey}`;
}

const getStatusStyle = (availability) => {
  switch (availability) {
    case "Available": return { color: "rgb(107, 225, 225)", textShadow: "0 0 8px rgba(0, 255, 255, 0.7)" };
    case "Blocked": return { color: "rgb(252, 243, 138)", textShadow: "0 0 8px rgba(255, 255, 0, 0.7)" };
    case "Sold": return { color: "rgb(248, 113, 113)", textShadow: "0 0 8px rgba(255, 0, 0, 0.7)" };
    default: return { color: "#e5e7eb" };
  }
};

export function Tooltip({ activePlot, position, zoomLevel = 1 }) {
  const tooltipRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [ui, setUi] = useState({ width: 280, pad: 16, title: 16, text: 14 });

  useLayoutEffect(() => {
    // responsive UI sizing
    const iw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    if (iw <= 360) setUi({ width: 180, pad: 8, title: 13, text: 11 });
    else if (iw <= 480) setUi({ width: 200, pad: 10, title: 14, text: 12 });
    else if (iw <= 768) setUi({ width: 240, pad: 12, title: 15, text: 13 });
    else setUi({ width: 280, pad: 16, title: 16, text: 14 });

    if (activePlot && tooltipRef.current) {
      const { innerWidth, innerHeight } = window;
      const { offsetWidth, offsetHeight } = tooltipRef.current;
      
      // Adjust offset based on zoom level - closer when zoomed in, further when zoomed out
      const baseOffset = 20;
      const zoomAdjustedOffset = Math.max(15, Math.min(40, baseOffset / Math.max(0.5, zoomLevel)));
      
      let top = position.y + zoomAdjustedOffset;
      let left = position.x + zoomAdjustedOffset;
      
      // Enhanced boundary checking with margins
      const margin = 15;
      if (left + offsetWidth > innerWidth - margin) { 
        left = position.x - offsetWidth - zoomAdjustedOffset; 
      }
      if (top + offsetHeight > innerHeight - margin) { 
        top = position.y - offsetHeight - zoomAdjustedOffset; 
      }
      
      // Ensure tooltip never goes completely off-screen
      if (left < margin) left = margin;
      if (top < margin) top = margin;
      if (left + offsetWidth > innerWidth - margin) left = innerWidth - offsetWidth - margin;
      if (top + offsetHeight > innerHeight - margin) top = innerHeight - offsetHeight - margin;
      
      setTooltipStyle({ top, left });
    }
  }, [activePlot, position, zoomLevel]);

  if (!activePlot) return null;

  return (
    <motion.div
      ref={tooltipRef}
      style={{ ...tooltipStyle, position: 'fixed', pointerEvents: 'none', zIndex: 10 }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div style={{ 
        padding: `${ui.pad}px`, 
        background: "rgba(20, 20, 20, 0.6)", 
        backdropFilter: "blur(12px)", 
        border: "1px solid rgba(255,255,255,0.1)", 
        borderRadius: "12px", 
        color: "white", 
        fontFamily: "sans-serif", 
        width: `${ui.width}px`,
        maxWidth: "90vw",
        maxHeight: "60vh",
        overflow: "hidden auto"
      }}>
        <h3 style={{ 
          fontSize: `${ui.title}px`, 
          fontWeight: "bold", 
          borderBottom: "1px solid rgba(255,255,255,0.1)", 
          paddingBottom: `${Math.max(6, Math.round(ui.pad*0.5))}px`, 
          marginBottom: `${Math.max(6, Math.round(ui.pad*0.5))}px` 
        }}>
          {titleForPlot(activePlot)}
        </h3>
        {activePlot.plotType === "villa" && activePlot.sheetData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: `${ui.text}px` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Status</span> 
              <strong style={getStatusStyle(activePlot.sheetData.availability)}>
                {activePlot.sheetData.availability}
              </strong>
            </div>
            {activePlot.sheetData.type && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Type</span> 
                <strong>{activePlot.sheetData.type}</strong>
              </div>
            )}
            {activePlot.sheetData.facing && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Facing</span> 
                <strong>{activePlot.sheetData.facing}</strong>
              </div>
            )}
            {activePlot.sheetData.sqft && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Sq. Ft</span> 
                <strong>{activePlot.sheetData.sqft}</strong>
              </div>
            )}
            {activePlot.sheetData.plotSize && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Plot Size</span> 
                <strong>{activePlot.sheetData.plotSize} SqYds</strong>
              </div>
            )}
          </div>
        ) : (
          <div style={{color: "#999", fontSize: `${ui.text}px`}}>This is a common area.</div>
        )}
      </div>
    </motion.div>
  );
}

// Export as both named and default for compatibility
export default Tooltip;
