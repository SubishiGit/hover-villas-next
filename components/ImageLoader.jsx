"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useProgressiveImage(basePath) {
  const [currentSrc, setCurrentSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const imageTiers = useMemo(() => ({
    placeholder: `${basePath}-placeholder.jpg`,
    small: `${basePath}-small.png`,
    medium: `${basePath}-medium.png`,
    large: `${basePath}-large.png`,
    vector: `${basePath}.svg`
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
        setCurrentSrc(imageTiers.placeholder);

        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewport = window.innerWidth;

        let targetImage;
        if (viewport > 1920 && devicePixelRatio > 1) {
          targetImage = imageTiers.large;
        } else if (viewport > 1200) {
          targetImage = imageTiers.medium;
        } else {
          targetImage = imageTiers.small;
        }

        const loadedSrc = await loadImage(targetImage);
        if (mounted) {
          setCurrentSrc(loadedSrc);
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setCurrentSrc(imageTiers.small);
          setIsLoading(false);
        }
      }
    };

    // Run only once on mount (basePath changes are rare)
    loadProgressive();
    return () => { mounted = false; };
  }, [basePath, loadImage]); // note: imageTiers intentionally NOT in deps

  return { currentSrc, isLoading, imageTiers };
}