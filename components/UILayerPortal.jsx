"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function UILayerPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState(null);

  useEffect(() => {
    setMounted(true);
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.pointerEvents = "none"; // allow underlying content, children can enable
    el.style.zIndex = "2147483647"; // max z-index layer
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  if (!mounted || !container) return null;

  return createPortal(children, container);
}


