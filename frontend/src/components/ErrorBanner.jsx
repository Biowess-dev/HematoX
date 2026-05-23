import React from 'react';

/**
 * ErrorBanner component for displaying errors.
 * Props:
 *  - message: string | null
 *  - onDismiss: function
 *  - actionLabel: string (optional) — label for an action button
 *  - onAction: function (optional) — callback for the action button
 */
export default function ErrorBanner({ message, onDismiss, actionLabel, onAction }) {
  if (!message) return null;

  return (
    <div style={{
      background: '#3d0a0a',
      border: '1px solid #7A1515',
      color: '#fca5a5',
      padding: '10px 14px',
      borderRadius: '4px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      fontSize: '13px',
      lineHeight: '1.4',
      boxSizing: 'border-box',
      width: '100%'
    }}>
      <div style={{ flex: 1, paddingRight: '8px' }}>
        <strong>Error:</strong> {message}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            style={{
              marginLeft: '10px',
              background: 'var(--accent)',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '4px',
              verticalAlign: 'middle',
              transition: 'opacity 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {actionLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#f87171',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: 0,
            outline: 'none'
          }}
          title="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
