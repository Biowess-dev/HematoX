import { useState, useEffect } from 'react';

export function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkBreakpoint = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkBreakpoint();

    // Listen for resize events
    window.addEventListener('resize', checkBreakpoint);

    // Cleanup
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return { isMobile };
}
