"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useProgressiveImage(basePath) {
  const [currentSrc, setCurrentSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const imageTiers = useMemo(() => ({
    placeholder: `${basePath}-placeholder.jpg`,
    original: `${basePath}.png`
  }), [basePath]);

  const loadImage = useCallback((src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadProgressive = async () => {
      try {
        // Start with placeholder for instant loading
        setCurrentSrc(imageTiers.placeholder);

        // Load the original full-size image
        const loadedSrc = await loadImage(imageTiers.original);
        if (mounted) {
          setCurrentSrc(loadedSrc);
          setIsLoading(false);
        }
      } catch {
        // Fallback to original if placeholder fails
        if (mounted) {
          setCurrentSrc(imageTiers.original);
          setIsLoading(false);
        }
      }
    };

    loadProgressive();
    return () => { mounted = false; };
  }, [basePath, loadImage, imageTiers.placeholder, imageTiers.original]);

  return { currentSrc, isLoading, imageTiers };
}