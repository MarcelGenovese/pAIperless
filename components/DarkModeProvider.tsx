"use client"

import { useEffect } from 'react';

/**
 * Client-side Dark Mode Provider
 * Loads dark mode setting from API and applies it to document
 * Works on all pages including login, setup, and about
 */
export default function DarkModeProvider() {
  useEffect(() => {
    // Load dark mode setting from config API
    const loadDarkMode = async () => {
      try {
        const response = await fetch('/api/setup/load-config?step=0');
        if (response.ok) {
          const data = await response.json();
          const isDark = data.darkMode === 'true';

          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (error) {
        // Fail silently - dark mode is not critical
        console.debug('Could not load dark mode setting:', error);
      }
    };

    loadDarkMode();
  }, []);

  return null;
}
