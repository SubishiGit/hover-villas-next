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

  useLayoutEffect(() => {
    if (activePlot && tooltipRef.current) {
      const { innerWidth, innerHeight } = window;
      const { offsetWidth, offsetHeight } = tooltipRef.current;
      let top = position.y + 20;
      let left = position.x + 20;
      
      if (left + offsetWidth > innerWidth - 20) { 
        left = position.x - offsetWidth - 20; 
      }
      if (top + offsetHeight > innerHeight - 20) { 
        top = position.y - offsetHeight - 20; 
      }
      
      setTooltipStyle({ top, left });
    }
  }, [activePlot, position]);

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
        padding: "16px", 
        background: "rgba(20, 20, 20, 0.6)", 
        backdropFilter: "blur(12px)", 
        border: "1px solid rgba(255,255,255,0.1)", 
        borderRadius: "12px", 
        color: "white", 
        fontFamily: "sans-serif", 
        width: "280px" 
      }}>
        <h3 style={{ 
          fontSize: "16px", 
          fontWeight: "bold", 
          borderBottom: "1px solid rgba(255,255,255,0.1)", 
          paddingBottom: "8px", 
          marginBottom: "8px" 
        }}>
          {titleForPlot(activePlot)}
        </h3>
        {activePlot.plotType === "villa" && activePlot.sheetData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px" }}>
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
          <div style={{color: "#999", fontSize: "14px"}}>This is a common area.</div>
        )}
      </div>
    </motion.div>
  );
}

// Export as both named and default for compatibility
export default Tooltip;
