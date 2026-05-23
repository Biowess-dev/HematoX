import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

/* ── Stagger timings ────────────────────────────────────────── */
const SPLASH_DURATION = 2800; // ms before onComplete
const BAR_DURATION = 2.5;  // seconds for progress bar

/* ── Logo with fallback ─────────────────────────────────────── */
function LogoMark() {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '18px',
          background: 'var(--accent-dim)',
          border: '1.5px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          fontWeight: 800,
          color: 'var(--accent)',
          letterSpacing: '-1px',
          fontFamily: "'Inter', system-ui, sans-serif",
          boxShadow: '0 0 32px rgba(163,29,29,0.25)',
        }}
      >
        H
      </div>
    );
  }

  return (
    <img
      src="/assets/logo.png"
      width={400}
      height={60}
      alt="HematoX"
      style={{ borderRadius: '14px', objectFit: 'contain' }}
      onError={() => setImgFailed(true)}
    />
  );
}

/* ── Animated loading bar ───────────────────────────────────── */
function LoadingBar() {
  const scaleX = useMotionValue(0);

  useEffect(() => {
    const controls = animate(scaleX, 1, {
      duration: BAR_DURATION,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
    return controls.stop;
  }, [scaleX]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <motion.div
        style={{
          height: '100%',
          background: 'linear-gradient(90deg, var(--accent) 0%, #e83535 60%, rgba(163,29,29,0.4) 100%)',
          scaleX,
          transformOrigin: 'left',
          boxShadow: '0 0 12px var(--accent-glow)',
        }}
      />
    </div>
  );
}

/* ── Main SplashScreen ──────────────────────────────────────── */
const containerVariants = {
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02, transition: { duration: 0.45, ease: 'easeInOut' } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (custom) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: custom * 0.12, ease: "easeOut" },
  }),
};

const logoVariants = {
  hidden: { opacity: 0, scale: 0.82 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function SplashScreen({ onComplete }) {
  const { t } = useLanguage();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      key="splash"
      initial="visible"
      animate={exiting ? 'exit' : 'visible'}
      variants={containerVariants}
      onAnimationComplete={(definition) => {
        if (definition === 'exit') onComplete();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-void)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial glow behind content */}
      <div
        style={{
          position: 'absolute',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(163,29,29,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Centered content stack */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          position: 'relative',
        }}
      >
        {/* 1. Logo */}
        <motion.div
          custom={0}
          variants={logoVariants}
          initial="hidden"
          animate="visible"
        >
          <LogoMark />
        </motion.div>

        {/* 2. App name */}
        <motion.div
          custom={1}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          style={{
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {t('hematoxPlatform')}
        </motion.div>

        {/* 3. Subtitle */}
        <motion.div
          custom={2}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: "'Inter', system-ui, sans-serif",
            marginTop: '-10px',
          }}
        >
          {t('hematologySystem')}
        </motion.div>
      </div>

      {/* 4. Copyright — pinned near bottom */}
      <motion.div
        custom={3}
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        style={{
          position: 'absolute',
          bottom: '28px',
          fontSize: '10px',
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        © 2026 BIOWESS
      </motion.div>

      {/* 5. Loading bar */}
      <LoadingBar />
    </motion.div>
  );
}
