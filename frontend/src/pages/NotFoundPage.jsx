import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100%',
      padding: 'var(--space-10)',
      textAlign: 'center'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card"
        style={{
          padding: 'var(--space-10)',
          maxWidth: '400px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)'
        }}
      >
        <div style={{
          fontSize: '64px',
          fontWeight: 700,
          color: 'var(--accent)',
          lineHeight: '1',
          letterSpacing: '-0.02em'
        }}>
          404
        </div>
        <div className="text-section-hd">
          Analysis not found
        </div>
        <div className="text-body" style={{ marginBottom: 'var(--space-4)' }}>
          The requested page or diagnostic report does not exist in the BIOWESS system.
        </div>
        <Link
          to="/"
          className="btn-accent"
          style={{ textDecoration: 'none' }}
        >
          Return to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
