import { useEffect, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import PageTransition from './PageTransition';
import { useBreakpoint } from '../hooks/useBreakpoint';

// Capture and freeze the outlet element for a single mount cycle.
// This prevents context updates from altering the exiting page during exit transition.
function AnimatedOutlet() {
  const o = useOutlet();
  const [frozenOutlet] = useState(o);
  return frozenOutlet;
}

const SIDEBAR_FULL  = 240;
const SIDEBAR_ICON  = 64;

export default function Layout() {
  const location = useLocation();
  const { isMobile } = useBreakpoint();
  const isDashboard = location.pathname === '/';

  // Sidebar starts uncollapsed (expanded) by default on all pages on desktop
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Track route changes to reset/synchronize expanded state to true
  useEffect(() => {
    setIsSidebarExpanded(true);
  }, [location.pathname]);

  // Click outside to collapse sidebar (non-mobile & non-dashboard only)
  useEffect(() => {
    if (isMobile) return;
    if (isDashboard) return;

    function handleDocumentClick(event) {
      const sidebarEl = document.getElementById('sidebar-container');
      if (sidebarEl && !sidebarEl.contains(event.target)) {
        setIsSidebarExpanded(false);
      }
    }

    if (isSidebarExpanded) {
      document.addEventListener('click', handleDocumentClick);
    }
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [isSidebarExpanded, isMobile, isDashboard]);

  // Determine standard grid margin matching Sidebar state
  const desktopMargin = isSidebarExpanded ? SIDEBAR_FULL : SIDEBAR_ICON;
  const marginLeft = isMobile ? 0 : desktopMargin;

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${marginLeft}px`);
  }, [marginLeft]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-void)' }}>
      <Sidebar isSidebarExpanded={isSidebarExpanded} setIsSidebarExpanded={setIsSidebarExpanded} />

      <motion.main
        animate={{ marginLeft }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          flex: 1,
          minHeight: '100vh',
          background: 'var(--bg-void)',
          overflowY: 'auto',
        }}
      >
        {/* Inner content wrapper */}
        <div
          style={{
            padding: isMobile ? 'var(--space-16) var(--space-4) var(--space-6) var(--space-4)' : 'var(--space-8) var(--space-10)',
            maxWidth: '1400px',
            margin: '0 auto',
          }}
        >
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <AnimatedOutlet />
            </PageTransition>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}
