import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

import SplashScreen from './components/SplashScreen';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CBCPage from './pages/CBCPage';
import CoagPage from './pages/CoagPage';
import ROTEMPage from './pages/ROTEMPage';
import CasebookPage from './pages/CasebookPage';
import CasebookReportPage from './pages/CasebookReportPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import apiClient from './api/client';
import { useLanguage } from './context/LanguageContext';

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const { language } = useLanguage();
  const [prevLanguage, setPrevLanguage] = useState(language);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (language !== prevLanguage) {
      setPrevLanguage(language);
      setSplashDone(false);
    }
  }, [language, prevLanguage]);

  /* ── On splash complete: check API key → toast ─────────── */
  function handleSplashComplete() {
    setSplashDone(true);
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      apiClient.get('/settings/key/status')
        .then(({ data }) => {
          if (data?.configured) {
            toast.success('HematoX connected', {
              duration: 3500,
              icon: '🔬',
            });
          }
        })
        .catch(() => {/* silently ignore */});
    }
  }

  return (
    <>
      {/* Splash — shown until dismissed */}
      <AnimatePresence>
        {!splashDone && (
          <SplashScreen key="splash" onComplete={handleSplashComplete} />
        )}
      </AnimatePresence>

      {/* App shell — rendered beneath splash, revealed on complete */}
      {splashDone && (
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="cbc" element={<CBCPage />} />
            <Route path="coag" element={<CoagPage />} />
            <Route path="rotem" element={<ROTEMPage />} />
            <Route path="casebook" element={<CasebookPage />} />
            <Route path="casebook/:reportId" element={<CasebookReportPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      )}
    </>
  );
}
