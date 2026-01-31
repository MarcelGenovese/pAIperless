"use client"

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface LogoProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

/**
 * Logo component that automatically switches between light and dark mode versions
 * In dark mode, appends "_dark" before the file extension
 * Example: logo_complete.png → logo_complete_dark.png
 */
export default function Logo({ src, alt, width, height, className, priority }: LogoProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial dark mode state
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    // Watch for dark mode changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Generate dark mode filename
  const getDarkSrc = (originalSrc: string) => {
    const lastDot = originalSrc.lastIndexOf('.');
    if (lastDot === -1) return originalSrc + '_dark';
    return originalSrc.substring(0, lastDot) + '_dark' + originalSrc.substring(lastDot);
  };

  const logoSrc = isDark ? getDarkSrc(src) : src;

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
