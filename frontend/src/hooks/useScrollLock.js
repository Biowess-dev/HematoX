import { useEffect } from 'react';

export function useScrollLock(isOpen) {
  useEffect(() => {
    if (!isOpen) return;

    // Calculate the width of the scrollbar to prevent layout shifts
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    outer.style.msOverflowStyle = 'scrollbar';
    document.body.appendChild(outer);
    
    const inner = document.createElement('div');
    outer.appendChild(inner);
    
    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode.removeChild(outer);

    // Apply the scrollbar width custom property and the locking class
    document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
    document.body.classList.add('scroll-locked');

    return () => {
      document.body.classList.remove('scroll-locked');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    };
  }, [isOpen]);
}
