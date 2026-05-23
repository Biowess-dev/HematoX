import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Droplet,
  Activity,
  BarChart3,
  BookOpen,
  MessageSquare,
  Settings,
  Menu,
  X,
} from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

/* ── Nav config ─────────────────────────────────────────────── */
const NAV_ITEMS = [
  { path: '/', labelKey: 'dashboard', Icon: LayoutDashboard, end: true },
  { path: '/cbc', labelKey: 'cbc', Icon: Droplet },
  { path: '/coag', labelKey: 'coagulation', Icon: Activity },
  { path: '/rotem', labelKey: 'rotem', Icon: BarChart3 },
  { path: '/casebook', labelKey: 'casebook', Icon: BookOpen },
  { path: '/chat', labelKey: 'chat', Icon: MessageSquare },
  { path: '/settings', labelKey: 'settings', Icon: Settings },
];

const SIDEBAR_W = 240;
const ICON_W = 64; // Collapsed width

/* ── Shared sidebar styles ──────────────────────────────────── */
const sidebarBase = {
  position: 'fixed',
  top: 0,
  left: 0,
  height: '100vh',
  background: 'var(--bg-glass)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  borderRight: 'var(--glass-border)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 200,
  overflowX: 'hidden',
};

/* ── Single nav item ────────────────────────────────────────── */
function NavItem({ path, labelKey, Icon, end, isSidebarExpanded, onClick }) {
  const { t } = useLanguage();
  return (
    <NavLink
      to={path}
      end={end}
      onClick={onClick}
      style={{ textDecoration: 'none' }}
    >
      {({ isActive }) => (
        <motion.div
          whileHover={{ x: isSidebarExpanded ? 3 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '42px',
            padding: isSidebarExpanded ? '0 16px' : '0',
            justifyContent: isSidebarExpanded ? 'flex-start' : 'center',
            marginInline: isSidebarExpanded ? 'var(--space-2)' : '0',
            borderRadius: isSidebarExpanded ? '8px' : '0',
            background: isActive
              ? (isSidebarExpanded ? 'var(--accent-dim)' : 'rgba(163,29,29,0.12)')
              : 'transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          {/* Active indicator bar for expanded mode */}
          <motion.div
            initial={false}
            animate={{
              width: (isSidebarExpanded && isActive) ? 2 : 0,
              opacity: (isSidebarExpanded && isActive) ? 1 : 0,
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: '8px',
              bottom: '8px',
              background: 'var(--accent)',
            }}
          />

          <Icon
            size={18}
            strokeWidth={1.5}
            style={{
              color: isActive ? 'var(--accent)' : 'currentColor',
              flexShrink: 0,
            }}
          />

          <motion.span
            initial={false}
            animate={{
              opacity: isSidebarExpanded ? 1 : 0,
              width: isSidebarExpanded ? 'auto' : 0,
              marginLeft: isSidebarExpanded ? 12 : 0,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              fontSize: '13.5px',
              fontWeight: isActive ? 500 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            {t(labelKey)}
          </motion.span>

          {/* Active dot/ring for collapsed mode */}
          <AnimatePresence>
            {!isSidebarExpanded && isActive && (
              <motion.div
                key="active-dot"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </NavLink>
  );
}

/* ── Logo block ─────────────────────────────────────────────── */
function LogoBlock({ isSidebarExpanded }) {
  return (
    <div style={{
      padding: '22px 20px',
      borderBottom: 'var(--glass-border)',
      height: '80px',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Collapsed logo (logosquare) */}
      <motion.div
        initial={false}
        animate={{
          opacity: isSidebarExpanded ? 0 : 1,
          scale: isSidebarExpanded ? 0.6 : 1,
          x: isSidebarExpanded ? -20 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'absolute',
          left: '18px',
          pointerEvents: isSidebarExpanded ? 'none' : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src="/assets/logosquare.png"
          alt="HematoX"
          style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: '6px' }}
        />
      </motion.div>

      {/* Expanded logo */}
      <motion.div
        initial={false}
        animate={{
          opacity: isSidebarExpanded ? 1 : 0,
          scale: isSidebarExpanded ? 1 : 0.8,
          x: isSidebarExpanded ? 0 : 20,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'absolute',
          left: '5px',
          pointerEvents: isSidebarExpanded ? 'auto' : 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <img
          src="/assets/logo.png"
          alt="HematoX"
          style={{ height: 34, width: 'auto', objectFit: 'contain' }}
        />
      </motion.div>
    </div>
  );
}

/* ── Desktop Sidebar (full / icon-only) ─────────────────────── */
function DesktopSidebar({ isSidebarExpanded, setIsSidebarExpanded }) {
  return (
    <motion.aside
      id="sidebar-container"
      animate={{ width: isSidebarExpanded ? SIDEBAR_W : ICON_W }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ ...sidebarBase }}
    >
      <LogoBlock isSidebarExpanded={isSidebarExpanded} />

      <nav style={{ flex: 1, paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            {...item}
            isSidebarExpanded={isSidebarExpanded}
            onClick={() => {
              if (!isSidebarExpanded) {
                setIsSidebarExpanded(true);
              }
            }}
          />
        ))}
      </nav>

      {/* Version tag */}
      <div style={{
        padding: '14px 20px',
        borderTop: 'var(--glass-border)',
        height: '42px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}>
        <motion.div
          initial={false}
          animate={{
            opacity: isSidebarExpanded ? 1 : 0,
            x: isSidebarExpanded ? 0 : -20,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          v2026.1
        </motion.div>
      </div>
    </motion.aside>
  );
}

/* ── Mobile overlay sidebar ─────────────────────────────────── */
function MobileOverlay({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 300,
            }}
          />

          {/* Slide-in panel */}
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -SIDEBAR_W }}
            animate={{ x: 0 }}
            exit={{ x: -SIDEBAR_W }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{ ...sidebarBase, width: SIDEBAR_W, zIndex: 301 }}
          >
            {/* Close button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 18px 16px',
              borderBottom: 'var(--glass-border)',
            }}>
              <img
                src="/assets/logo.png"
                alt="HematoX"
                style={{ height: 32, width: 'auto', objectFit: 'contain' }}
              />
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <nav style={{ flex: 1, paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {NAV_ITEMS.map((item) => (
                <NavItem key={item.path} {...item} isSidebarExpanded={true} onClick={onClose} />
              ))}
            </nav>

            <div style={{ padding: '14px 20px', fontSize: '10px', color: 'var(--text-muted)', borderTop: 'var(--glass-border)' }}>
              v2026.1
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Mobile top navigation bar ─────────────────────────────────── */
function MobileNavBar({ onOpen }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      zIndex: 200,
      background: 'var(--bg-glass)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      borderBottom: 'var(--glass-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onOpen}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
          }}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <img
          src="/assets/logosquare.png"
          alt="HematoX"
          style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: '5px' }}
        />
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          HematoX
        </span>
      </div>
    </div>
  );
}

/* ── Root Sidebar export ─────────────────────────────────────── */
export default function Sidebar({ isSidebarExpanded, setIsSidebarExpanded }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <>
        <MobileNavBar onOpen={() => setMenuOpen(true)} />
        <MobileOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
      </>
    );
  }

  return (
    <DesktopSidebar
      isSidebarExpanded={isSidebarExpanded}
      setIsSidebarExpanded={setIsSidebarExpanded}
    />
  );
}
