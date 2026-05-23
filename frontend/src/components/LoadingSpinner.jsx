import React, { useEffect } from 'react';

/**
 * LoadingSpinner component for visual loading state.
 * Props:
 *  - size: number (default: 24)
 */
export default function LoadingSpinner({ size = 24 }) {
  useEffect(() => {
    const styleId = 'loading-spinner-spin-animation';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: '3px solid #222226',
        borderTop: '3px solid #A31D1D',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        boxSizing: 'border-box'
      }}
    />
  );
}
