import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import apiClient from '../api/client';
import ChatWorkspace from '../components/ChatWorkspace';
import { Plus, Trash2, ArrowLeft, MessageSquare, AlertTriangle, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useLanguage } from '../context/LanguageContext';
import { useScrollLock } from '../hooks/useScrollLock';

const Portal = ({ children }) => {
  return createPortal(children, document.body);
};

export default function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t, language } = useLanguage();

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lock scroll when modal or mobile drawer is open
  useScrollLock(showDeleteModal || (isMobile && drawerOpen));

  const isFirstMount = useRef(true);
  // Keep refs so callbacks/cleanup always read the latest values
  const sessionsRef = useRef([]);
  const activeSessionIdRef = useRef(null);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  useEffect(() => {
    apiClient.get('/chat/sessions')
      .then(response => {
        const data = response.data || [];
        setSessions(data);
        
        if (isFirstMount.current) {
          isFirstMount.current = false;
          handleNewSession();
        }
      })
      .catch(error => {
        console.error('Error fetching sessions:', error);
      });
  }, []);

  const handleSelectSession = (newSessionId) => {
    if (activeSessionId === newSessionId) {
      if (isMobile) setDrawerOpen(false);
      return;
    }

    const currentActiveSession = sessions.find(s => s.id === activeSessionId);
    if (currentActiveSession && currentActiveSession.isEmpty) {
      const emptyIdToDelete = activeSessionId;
      // Remove from state immediately so handleNewSession won't reuse a stale empty session
      setSessions(prev => prev.filter(s => s.id !== emptyIdToDelete));
      apiClient.delete(`/chat/sessions/${emptyIdToDelete}`)
        .catch(err => console.error("Error deleting empty session:", err));
    }

    setActiveSessionId(newSessionId);
    if (isMobile) setDrawerOpen(false);
  };

  // Clean up empty sessions when user navigates away from the chat page
  useEffect(() => {
    return () => {
      const empty = sessionsRef.current.filter(s => s.isEmpty);
      empty.forEach(s => {
        apiClient.delete(`/chat/sessions/${s.id}`).catch(() => {});
      });
    };
  }, []);

  // Automatically attach reports if specified in query params
  useEffect(() => {
    const attachReportsStr = searchParams.get('attachReports');
    const attachReportStr = searchParams.get('attachReport');

    if (sessions.length > 0 && (attachReportsStr || attachReportStr)) {
      // Find or create an active chat session to inject references
      const currentActiveSession = sessions.find(s => s.id === activeSessionId);
      if (currentActiveSession && currentActiveSession.isEmpty) {
        // We can just use the existing empty active session.
        // Let ChatWorkspace handle the attachment and clearing.
      } else {
        // Trigger a new session creation.
        // Do NOT clear parameters here; let the new ChatWorkspace clear them once mounted.
        handleNewSession();
      }
    }
  }, [sessions, activeSessionId, searchParams]);

  const handleNewSession = () => {
    // Read latest values from refs to avoid stale closures
    const currentSessions = sessionsRef.current;
    const currentActiveId = activeSessionIdRef.current;

    // If already on an empty (unsent) session, just make sure it's visible
    const currentActive = currentSessions.find(s => s.id === currentActiveId);
    if (currentActive && currentActive.isEmpty) {
      if (isMobile) setDrawerOpen(false);
      return;
    }

    // Remove any lingering empty sessions before creating a fresh one
    const staleSessions = currentSessions.filter(s => s.isEmpty);
    if (staleSessions.length > 0) {
      setSessions(prev => prev.filter(s => !s.isEmpty));
      staleSessions.forEach(s => {
        apiClient.delete(`/chat/sessions/${s.id}`).catch(() => {});
      });
    }

    apiClient.post('/chat/sessions')
      .then(response => {
        const newSession = response.data;
        if (!newSession.id && newSession.session_id) {
          newSession.id = newSession.session_id;
        }
        if (!newSession.created_at) {
          newSession.created_at = new Date().toISOString();
        }
        newSession.isEmpty = true; // Mark as empty until first message
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        if (isMobile) setDrawerOpen(false);
      })
      .catch(error => {
        console.error('Error creating session:', error);
      });
  };

  const handleRename = (id, newTitle) => {
    if (!newTitle.trim()) {
      setEditingId(null);
      return;
    }

    apiClient.put(`/chat/sessions/${id}`, { title: newTitle })
      .then(() => {
        setSessions(prev =>
          prev.map(s => s.id === id ? { ...s, title: newTitle } : s)
        );
      })
      .catch(error => {
        console.error('Error renaming session:', error);
      })
      .finally(() => {
        setEditingId(null);
      });
  };

  const handleDeleteSession = (e, id) => {
    e.stopPropagation();
    setSessionToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/chat/sessions/${sessionToDelete}`);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
      if (activeSessionId === sessionToDelete) {
        setActiveSessionId(null);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSessionToDelete(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div 
      style={{
        display: 'flex',
        height: '100vh',
        marginTop: isMobile ? 'calc(var(--space-16) * -1)' : 'calc(var(--space-8) * -1)',
        marginBottom: isMobile ? 'calc(var(--space-6) * -1)' : 'calc(var(--space-8) * -1)',
        marginLeft: isMobile ? 'calc(var(--space-4) * -1)' : 'calc(var(--space-10) * -1)',
        marginRight: isMobile ? 'calc(var(--space-4) * -1)' : 'calc(var(--space-10) * -1)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        background: 'var(--bg-void)'
      }}
    >
      {/* Left Column (Sidebar Drawer Overlay on Mobile, Inline on Desktop) */}
      <AnimatePresence>
        {(!isMobile || drawerOpen) && (
          <>
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  zIndex: 999
                }}
              />
            )}
            <motion.div 
              initial={isMobile ? { x: '-100%' } : false}
              animate={isMobile ? { x: 0 } : false}
              exit={isMobile ? { x: '-100%' } : false}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{
                width: '280px',
                flexShrink: 0,
                background: 'var(--bg-glass)',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                borderRight: 'var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: isMobile ? 'fixed' : 'relative',
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: isMobile ? 1000 : 5
              }}
            >
              {/* Header */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-4) var(--space-4) var(--space-2) var(--space-4)',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                  {t('conversations')}
                </span>
                <button 
                  onClick={handleNewSession}
                  className="btn-pill"
                  style={{
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-dim)'
                  }}
                  title={t('newChat')}
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Session List */}
              <div 
                className="scrollbar-thin"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: 'var(--space-2) 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <AnimatePresence>
                  {sessions.map((session) => {
                    const isActive = activeSessionId === session.id;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, margin: 0, padding: 0 }}
                        whileHover={{ x: 2 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '12px 14px',
                          margin: '2px var(--space-3)',
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-card)',
                          borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                          background: isActive ? 'var(--accent-dim)' : 'transparent',
                          transition: 'background 0.2s ease, border-color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', gap: 'var(--space-2)', width: '100%' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {editingId === session.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.target.blur();
                                  } else if (e.key === 'Escape') {
                                    setEditingId(null);
                                  }
                                }}
                                onBlur={() => {
                                  if (editingId === session.id) {
                                    handleRename(session.id, editTitle);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="input-glass"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '13px'
                                }}
                              />
                            ) : (
                              <span
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(session.id);
                                  setEditTitle(session.title || t('newSession'));
                                }}
                                style={{
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: '13.5px',
                                  fontWeight: isActive ? 600 : 400,
                                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                                title={t('doubleClickToRename')}
                              >
                                {session.title || t('newSession')}
                              </span>
                            )}
                          </div>

                          {editingId !== session.id && (
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'color 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              title={t('deleteSession')}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        
                        {/* Date details */}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {formatDate(session.created_at)}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Right Column (Workspace) */}
      <div 
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: 'var(--bg-void)',
          height: '100%'
        }}
      >
        {isMobile && (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border-dim)',
              background: 'var(--bg-glass)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              flexShrink: 0
            }}
          >
            <button 
              onClick={() => setDrawerOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: '13.5px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <MessageSquare size={16} style={{ color: 'var(--accent)' }} /> {t('conversations')}
            </button>
            <button 
              onClick={handleNewSession}
              className="btn-accent btn-pill"
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} /> {t('newChat')}
            </button>
          </div>
        )}
        {activeSessionId === null ? (
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '14px',
              padding: 'var(--space-8)',
              textAlign: 'center',
              background: 'var(--bg-void)',
              gap: 'var(--space-2)'
            }}
          >
            <div 
              style={{
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-2)'
              }}
            >
              <MessageSquare size={28} />
            </div>
            <p style={{ margin: 0 }}>{t('selectOrCreateSession')}</p>
          </div>
        ) : (
          <ChatWorkspace 
            key={activeSessionId}
            sessionId={activeSessionId} 
            onSessionUpdated={(newTitle) => {
              setSessions(prev =>
                prev.map(s => s.id === activeSessionId ? { ...s, title: newTitle, isEmpty: false } : s)
              );
            }}
          />
        )}
      </div>

      {/* ── Delete Confirmation Modal ────────────────────────────── */}
      <AnimatePresence>
        {showDeleteModal && (
          <Portal key="chat-delete-modal">
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
                touchAction: 'none',
              }}
              onClick={() => !isDeleting && setShowDeleteModal(false)}
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
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '14px',
                  borderRadius: '50%',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                    {language === 'fr' ? 'Supprimer la conversation ?' : 'Delete Conversation?'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                    {language === 'fr'
                      ? 'Cette action est irréversible. Tous les messages seront définitivement supprimés.'
                      : 'This action cannot be undone. All messages in this conversation will be permanently deleted.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                  <button
                    className="btn-pill"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                  >
                    {language === 'fr' ? 'Annuler' : 'Cancel'}
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
                      fontWeight: 500,
                    }}
                    onClick={confirmDeleteSession}
                    disabled={isDeleting}
                  >
                    {isDeleting
                      ? <Loader size={14} className="spinner" />
                      : (language === 'fr' ? 'Supprimer' : 'Delete')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}
