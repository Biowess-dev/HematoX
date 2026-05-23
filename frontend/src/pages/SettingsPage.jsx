import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../hooks/useScrollLock';
import {
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Trash2,
  Lock,
  Loader,
  Moon,
  Sun
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

export default function SettingsPage() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { isMobile } = useBreakpoint();

  // Reusable confirmation modal state
  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isExecuting: false
  });

  useScrollLock(modal.isOpen);

  // Fetch API key status and assets on mount
  useEffect(() => {
    fetchStatus();
    fetchAssets();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await apiClient.get('/settings/key/status');
      setIsConfigured(response.data.configured);
    } catch (error) {
      console.error('Error fetching API key status:', error);
    }
  };

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const response = await apiClient.get('/settings/assets');
      setAssets(response.data.files || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error(t('failedToLoadAssets') || "Failed to load corpus assets");
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) {
      toast.error(t('apiKeyEmpty') || "API key cannot be empty");
      return;
    }

    setIsSavingKey(true);
    try {
      await apiClient.post('/settings/key', { api_key: apiKeyInput });
      toast.success(t('apiKeySaved') || "API Key saved and connected");
      setApiKeyInput("");
      fetchStatus();
    } catch (error) {
      console.error('Error saving API key:', error);
      const msg = error.response?.data?.detail || error.message || "An error occurred while saving the key.";
      toast.error(msg);
    } finally {
      setIsSavingKey(false);
    }
  };

  // Danger Zone Handlers
  const handleClearReports = async () => {
    try {
      await apiClient.delete('/reports');
      toast.success(t('reportsCleared') || "All reports soft-deleted successfully");
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || "Failed to clear reports.";
      toast.error(msg);
      throw error;
    }
  };

  const handleClearChats = async () => {
    try {
      await apiClient.delete('/chat/sessions');
      toast.success(t('chatsCleared') || "All chat sessions cleared successfully");
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || "Failed to clear chat sessions.";
      toast.error(msg);
      throw error;
    }
  };

  const confirmAction = ({ title, message, onConfirm }) => {
    setModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      isExecuting: false
    });
  };

  const handleConfirmModal = async () => {
    if (!modal.onConfirm) return;
    setModal(prev => ({ ...prev, isExecuting: true }));
    try {
      await modal.onConfirm();
      setModal({ isOpen: false, title: "", message: "", onConfirm: null, isExecuting: false });
    } catch (error) {
      console.error("Action execution failed:", error);
      setModal(prev => ({ ...prev, isExecuting: false }));
    }
  };

  // Layout animations
  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', padding: isMobile ? '0 16px var(--space-10) 16px' : '0 0 var(--space-10) 0' }}>

      {/* Page Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? 'var(--space-4)' : '0px',
        marginBottom: 'var(--space-8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-dim)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: 'var(--accent)',
              flexShrink: 0
            }}
          >
            <Settings size={20} strokeWidth={2.2} />
          </div>
          <h1 className="text-page-title" style={{ margin: 0 }}>
            {t('settings')}
          </h1>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn-pill"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', alignSelf: isMobile ? 'stretch' : 'auto', justifyContent: 'center' }}
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span style={{ fontSize: '13px' }}>{theme === 'dark' ? t('lightMode') : t('darkMode')}</span>
        </button>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
      >

        {/* Section 1: API Configuration */}
        <motion.section
          variants={cardVariants}
          className="glass-card"
          style={{ padding: 'var(--space-6)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {t('apiConfiguration')}
            </h2>

            {/* Status Chip */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: '20px',
              background: isConfigured ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isConfigured ? '#4ade80' : '#f87171',
              border: isConfigured ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.15)',
            }}>
              {isConfigured ? (
                <>
                  <CheckCircle size={14} />
                  {t('apiConnected')}
                </>
              ) : (
                <>
                  <XCircle size={14} />
                  {t('apiKeyNotConfigured')}
                </>
              )}
            </div>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
            {t('apiHelpText')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="input-glass"
                placeholder={t('apiKeyPlaceholder')}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{ paddingRight: '40px' }}
              />
              <Lock size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                onClick={handleSaveKey}
                disabled={isSavingKey}
                className="btn-accent btn-pill"
              >
                {isSavingKey && <Loader size={14} className="spinner" style={{ marginRight: '6px' }} />}
                {isSavingKey ? t('saving') : t('saveKey')}
              </button>
            </div>
          </div>
        </motion.section>

        {/* Section: Interface Settings */}
        <motion.section
          variants={cardVariants}
          className="glass-card"
          style={{ padding: 'var(--space-6)' }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            {t('interfaceSettings')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="input-label" style={{ marginBottom: '4px' }}>
              {t('interfaceLanguage')}
            </label>
            <select
              className="input-glass"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ width: '100%', maxWidth: '240px' }}
            >
              <option value="en">{t('english')}</option>
              <option value="fr">{t('french')}</option>
            </select>
          </div>
        </motion.section>

        {/* Section 2: Knowledge Base */}
        <motion.section
          variants={cardVariants}
          className="glass-card"
          style={{ padding: 'var(--space-6)' }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            {t('knowledgeBase')}
          </h2>

          {loadingAssets ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <Loader size={20} className="spinner" style={{ color: 'var(--accent)' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              {assets.map((file, idx) => {
                const isAvailable = file.available && file.size_bytes >= 200;

                return (
                  <div
                    key={file.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: idx < assets.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: 'rgba(255, 255, 255, 0.01)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {file.name}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {(file.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: isAvailable ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: isAvailable ? '#4ade80' : '#fbbf24',
                      border: isAvailable ? '1px solid rgba(34, 197, 94, 0.15)' : '1px solid rgba(245, 158, 11, 0.15)'
                    }}>
                      {isAvailable ? t('available') : t('empty')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.5'
          }}>
            <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px' }} />
            <span>{t('corpusUpdateText')}</span>
          </div>
        </motion.section>

        {/* Section 3: About */}
        <motion.section
          variants={cardVariants}
          className="glass-card"
          style={{ padding: 'var(--space-6)' }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            {t('about')}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('application')}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>HematoX</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('version')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>v2026.1</span>
            </div>

            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(163, 29, 29, 0.05)',
              border: '1px solid rgba(163, 29, 29, 0.15)',
              fontSize: '12px',
              color: '#f87171',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {t('educationalWarning')}
            </div>
          </div>
        </motion.section>

        {/* Section 4: Danger Zone */}
        <motion.section
          variants={cardVariants}
          className="glass-card"
          style={{
            padding: 'var(--space-6)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.05)'
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={20} />
            {t('dangerZone')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
            {t('dangerZoneHelpText')}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button
              className="btn-pill"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.05)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => confirmAction({
                title: t('clearReportsModalTitle'),
                message: t('clearReportsModalMessage'),
                onConfirm: handleClearReports
              })}
            >
              <Trash2 size={16} />
              {t('clearAllReports')}
            </button>

            <button
              className="btn-pill"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.05)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => confirmAction({
                title: t('clearChatsModalTitle'),
                message: t('clearChatsModalMessage'),
                onConfirm: handleClearChats
              })}
            >
              <Trash2 size={16} />
              {t('clearAllChats')}
            </button>
          </div>
        </motion.section>

      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {modal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              touchAction: 'none'
            }}
            onClick={() => !modal.isExecuting && setModal(prev => ({ ...prev, isOpen: false }))}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              className="glass-card"
              style={{
                maxWidth: '400px',
                width: '100%',
                padding: '28px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '14px',
                borderRadius: '50%',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={32} />
              </div>

              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                  {modal.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                  {modal.message}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                <button
                  className="btn-pill"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={modal.isExecuting}
                >
                  {t('cancel')}
                </button>
                <button
                  className="btn-accent"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: '#A31D1D',
                    borderColor: '#A31D1D',
                    borderRadius: 'var(--radius-pill)',
                    padding: '6px 18px',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                  onClick={handleConfirmModal}
                  disabled={modal.isExecuting}
                >
                  {modal.isExecuting ? (
                    <Loader size={14} className="spinner" />
                  ) : (
                    t('confirm')
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
