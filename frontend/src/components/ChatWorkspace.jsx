import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Paperclip, Send, Copy, AlertCircle, X, BookOpen, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

function isOffTopicRefusal(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (lower.includes("outside my scope") || lower.includes("outside the scope") || lower.includes("cannot assist") || lower.includes("not able to help")) &&
         (lower.includes("hematology") || lower.includes("redirect") || lower.includes("lab") || lower.includes("blood"));
}

/**
 * ChatWorkspace component.
 * Props:
 *  - sessionId: string
 *  - onSessionUpdated: (newTitle: string) => void
 */
export default function ChatWorkspace({ sessionId, onSessionUpdated }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [attachedReports, setAttachedReports] = useState([]);
  const [showAttachDropdown, setShowAttachDropdown] = useState(false);
  const [availableReports, setAvailableReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Autocomplete state
  const [autocompleteQuery, setAutocompleteQuery] = useState(null);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const attachReportParam = searchParams.get('attachReport') || searchParams.get('attachReports');

  const messageListRef = useRef(null);
  const dropdownRef = useRef(null);
  const textareaRef = useRef(null);

  // Fetch available reports on mount
  useEffect(() => {
    apiClient.get('/reports')
      .then(response => {
        const reports = response.data || [];
        setAvailableReports(reports);
        
        if (attachReportParam) {
          const reportIds = attachReportParam.split(',');
          const attached = [];
          reportIds.forEach(idStr => {
            const trimmed = idStr.trim();
            if (trimmed) {
              const report = reports.find(r => String(r.id) === trimmed);
              if (report) {
                attached.push({ id: report.id, title: report.title, display_id: report.display_id });
              }
            }
          });

          if (attached.length > 0) {
            setAttachedReports(attached);
            toast.success(`${attached.length} report(s) referenced in chat`);
          }
          
          // Remove param from URL
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('attachReport');
          newParams.delete('attachReports');
          setSearchParams(newParams, { replace: true });
        }
      })
      .catch(error => {
        console.error('Error fetching available reports:', error);
      });
  }, [attachReportParam]);

  // Fetch session messages on sessionId change
  useEffect(() => {
    if (!sessionId) return;
    
    setIsLoading(false);
    apiClient.get(`/chat/sessions/${sessionId}/messages`)
      .then(response => {
        setMessages(response.data || []);
      })
      .catch(error => {
        console.error('Error fetching session messages:', error);
        setMessages([]);
      });
  }, [sessionId]);

  // Scroll to bottom when messages list changes
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAttachDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Handle textarea height auto-adjustment
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      if (inputText) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    }
  }, [inputText]);

  // Auto-detect typed report references (e.g. /REP-xxxx or /CBC-xxxx)
  useEffect(() => {
    if (!inputText || availableReports.length === 0) return;
    
    const matches = inputText.match(/\/([A-Za-z0-9-]+)/g);
    if (!matches) return;
    
    matches.forEach(match => {
      const displayId = match.substring(1).toUpperCase();
      const report = availableReports.find(r => r.display_id?.toUpperCase() === displayId);
      if (report) {
        if (!attachedReports.some(r => r.id === report.id)) {
          setAttachedReports(prev => [...prev, { id: report.id, title: report.title, display_id: report.display_id }]);
          toast.success(`Report ${report.display_id} attached via reference`);
        }
      }
    });
  }, [inputText, availableReports, attachedReports]);

  const handleRemoveAttachedReport = (reportId, displayId) => {
    setAttachedReports(prev => prev.filter(r => r.id !== reportId));
    if (displayId) {
      const regex = new RegExp(`\\/${displayId}\\b`, 'gi');
      setInputText(prev => prev.replace(regex, '').trim());
    }
  };

  // Filter available reports to exclude already attached ones
  const filteredReports = availableReports.filter(
    report => !attachedReports.some(attached => attached.id === report.id)
  );

  // Filter for autocomplete
  const autocompleteOptions = availableReports.filter(r => 
    r.display_id?.toLowerCase().includes(autocompleteQuery?.toLowerCase() || '') ||
    r.title?.toLowerCase().includes(autocompleteQuery?.toLowerCase() || '')
  );

  // Parse text for autocomplete trigger
  useEffect(() => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = inputText.slice(0, cursor);
    const lastWordMatch = textBeforeCursor.match(/(\/\S*)$/);

    if (lastWordMatch) {
      setAutocompleteQuery(lastWordMatch[1].slice(1));
      setAutocompleteIndex(0);
    } else {
      setAutocompleteQuery(null);
    }
  }, [inputText]);

  const insertAutocomplete = (report) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursor);
    const textAfterCursor = inputText.slice(cursor);
    const lastWordMatch = textBeforeCursor.match(/(\/\S*)$/);
    
    if (lastWordMatch) {
      const startIdx = textBeforeCursor.lastIndexOf(lastWordMatch[1]);
      const newText = inputText.slice(0, startIdx) + `/${report.display_id} ` + textAfterCursor;
      setInputText(newText);
      setAutocompleteQuery(null);
      
      // Also add to attached reports if not already attached!
      if (!attachedReports.some(r => r.id === report.id)) {
        setAttachedReports(prev => [...prev, { id: report.id, title: report.title, display_id: report.display_id }]);
      }
      
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (autocompleteQuery !== null && autocompleteOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev + 1) % autocompleteOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev - 1 + autocompleteOptions.length) % autocompleteOptions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertAutocomplete(autocompleteOptions[autocompleteIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setAutocompleteQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(t('copied'));
  };

  const handleSend = () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput || isLoading) return;

    const reportsToSend = [...attachedReports];
    const userMessage = { 
      role: 'user', 
      content: trimmedInput, 
      referenced_reports: reportsToSend.length > 0 ? JSON.stringify(reportsToSend) : null 
    };
    setMessages(prev => [...prev, userMessage]);

    const textToSend = trimmedInput;

    setInputText('');
    setAttachedReports([]);
    setIsLoading(true);
    setAutocompleteQuery(null);

    apiClient.post(`/chat/sessions/${sessionId}/send`, {
      message: textToSend,
      attached_report_ids: reportsToSend.map(r => r.id)
    })
    .then(response => {
      const modelMessage = { 
        role: 'model', 
        content: response.data.answer,
        referenced_reports: reportsToSend.length > 0 ? JSON.stringify(reportsToSend) : null
      };
      setMessages(prev => [...prev, modelMessage]);
      if (response.data.title && onSessionUpdated) {
        onSessionUpdated(response.data.title);
      }
    })
    .catch(error => {
      let content;
      if (error.isServiceUnavailable) {
        content = '⚠️ The AI service is currently unreachable. Please check your Gemini API key in Settings before continuing.';
      } else {
        const errorMessage = error.response?.data?.detail || error.message || 'An unknown error occurred';
        content = `⚠ Error: ${errorMessage}`;
      }
      setMessages(prev => [...prev, { role: 'model', content, id: 'error-' + Date.now() }]);
    })
    .finally(() => {
      setIsLoading(false);
    });
  };

  // Convert occurrences of /display_id in model content to markdown links [display_id](/casebook/id)
  const processMessageContent = (content) => {
    if (!content) return "";
    let processed = content;
    availableReports.forEach(report => {
      if (report.display_id) {
        const escapedId = report.display_id.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\/${escapedId}\\b`, 'g');
        processed = processed.replace(regex, `[${report.display_id}](/casebook/${report.id})`);
      }
    });
    return processed;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-void)' }}>
      {/* Message List Area */}
      <div
        ref={messageListRef}
        className="scrollbar-thin"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)'
        }}
      >
        {messages.length === 0 ? (
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              padding: 'var(--space-8)',
              textAlign: 'center',
              maxWidth: '680px',
              margin: '0 auto',
              gap: 'var(--space-6)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
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
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {t('consultWithHematox')}
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.5, margin: 0 }}>
                {t('chatWelcomeSub')}
              </p>
            </div>

            {/* Suggestion cards */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-3)',
                width: '100%',
                marginTop: 'var(--space-2)'
              }}
            >
              {[
                { 
                  label: t('suggestInterpretCbc'), 
                  desc: t('suggestInterpretCbcDesc'),
                  text: availableReports.length > 0 && availableReports[0].display_id 
                    ? `Can you analyze the report /${availableReports[0].display_id}?`
                    : "Can you interpret my latest CBC report?"
                },
                { 
                  label: t('suggestApttPt'), 
                  desc: t('suggestApttPtDesc'),
                  text: "What is the clinical approach for a patient with isolated prolonged APTT?"
                },
                { 
                  label: t('suggestRotem'), 
                  desc: t('suggestRotemDesc'),
                  text: "Explain the characteristic ROTEM patterns for hyperfibrinolysis."
                }
              ].map((card, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setInputText(card.text);
                    if (textareaRef.current) textareaRef.current.focus();
                  }}
                  className="glass-card"
                  style={{
                    padding: 'var(--space-4)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: 'var(--bg-glass)',
                    border: 'var(--glass-border)',
                    borderRadius: 'var(--radius-card)',
                    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {card.label}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {card.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isError = msg.role === 'model' && msg.content.startsWith('⚠ Error:');
            const isOffTopic = !isUser && isOffTopicRefusal(msg.content);

            let referencedReports = [];
            try {
              if (msg.referenced_reports) {
                referencedReports = typeof msg.referenced_reports === 'string'
                  ? JSON.parse(msg.referenced_reports)
                  : msg.referenced_reports;
              }
            } catch (e) {
              console.error("Error parsing referenced reports:", e);
            }

            if (isUser) {
              return (
                <div
                  key={msg.id || index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    alignSelf: 'flex-end',
                    maxWidth: '75%'
                  }}
                >
                  <div
                    style={{
                      background: 'linear-gradient(135deg, var(--accent) 0%, rgba(163,29,29,0.7) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      width: '100%',
                      padding: '12px 18px',
                      fontSize: '13.5px',
                      whiteSpace: 'pre-wrap',
                      boxShadow: 'var(--shadow-md)',
                      borderRadius: '16px 16px 2px 16px',
                      lineHeight: 1.5
                    }}
                  >
                    {msg.content}
                  </div>
                  {referencedReports && referencedReports.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginTop: '6px',
                        justifyContent: 'flex-end'
                      }}
                    >
                      {referencedReports.map((report) => (
                        <div
                          key={report.id}
                          onClick={() => navigate(`/casebook/${report.id}`)}
                          className="referenced-report-pill"
                          title={report.title}
                        >
                          <BookOpen size={11} />
                          <span>{report.display_id || report.title.substring(0, 15)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            } else {
              return (
                <div
                  key={msg.id || index}
                  className="glass-panel"
                  style={{
                    position: 'relative',
                    alignSelf: 'flex-start',
                    background: 'var(--bg-glass)',
                    backdropFilter: 'var(--glass-blur)',
                    WebkitBackdropFilter: 'var(--glass-blur)',
                    border: 'var(--glass-border)',
                    borderLeft: '3px solid var(--accent)',
                    maxWidth: '85%',
                    padding: '16px var(--space-5)',
                    boxShadow: 'var(--shadow-md)',
                    borderRadius: '2px 16px 16px 16px',
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  {!isError && (
                    <button
                      onClick={() => copyToClipboard(msg.content)}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: '6px',
                        padding: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.borderColor = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border-dim)';
                      }}
                      title="Copy message"
                    >
                      <Copy size={13} />
                    </button>
                  )}
                  
                  {isOffTopic && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                      <AlertCircle size={14} />
                      <span>Out of Scope</span>
                    </div>
                  )}
                  
                  {isError ? (
                    <div style={{ color: '#f87171', fontSize: '13px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div className="markdown-content text-sm leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, href, ...props }) => {
                            const isInternal = href && (href.startsWith('/casebook/') || href.startsWith('file:///casebook/'));
                            if (isInternal) {
                              const cleanHref = href.replace('file://', '');
                              return (
                                <a
                                  href={cleanHref}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigate(cleanHref);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'var(--accent-dim)',
                                    border: '1px solid var(--accent)',
                                    color: 'var(--accent)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-input)',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    fontFamily: 'var(--font-mono)',
                                    textDecoration: 'none',
                                    verticalAlign: 'middle',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--accent)';
                                    e.currentTarget.style.color = '#ffffff';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--accent-dim)';
                                    e.currentTarget.style.color = 'var(--accent)';
                                  }}
                                >
                                  <BookOpen size={11} style={{ flexShrink: 0 }} />
                                  {props.children}
                                </a>
                              );
                            }
                            return (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                                {...props}
                              />
                            );
                          },
                          table: ({ node, ...props }) => (
                            <div className="markdown-table-wrapper">
                              <table className="markdown-table" {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => <th {...props} />,
                          td: ({ node, ...props }) => <td {...props} />,
                          code: ({ node, inline, ...props }) => (
                            inline 
                              ? <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px', fontSize: '12.5px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }} {...props} />
                              : <code style={{ fontFamily: 'var(--font-mono)' }} {...props} />
                          ),
                          pre: ({ node, ...props }) => (
                            <pre style={{ background: 'var(--bg-void)', padding: '12px 16px', borderRadius: 'var(--radius-card)', overflowX: 'auto', margin: '12px 0', border: '1px solid var(--border-dim)', fontSize: '12.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }} {...props} />
                          )
                        }}
                      >
                        {processMessageContent(msg.content)}
                      </ReactMarkdown>
                    </div>
                  )}
                  
                  {referencedReports && referencedReports.length > 0 && (
                    <div
                      style={{
                        marginTop: '14px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {t('referencedReports')}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {referencedReports.map((report) => (
                          <div
                            key={report.id}
                            onClick={() => navigate(`/casebook/${report.id}`)}
                            className="referenced-report-pill"
                            title={report.title}
                          >
                            <BookOpen size={11} />
                            <span>{report.display_id || report.title.substring(0, 15)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          })
        )}
        {isLoading && (
          <div 
            style={{
              alignSelf: 'flex-start',
              background: 'var(--bg-glass)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: 'var(--glass-border)',
              borderLeft: '3px solid var(--accent)',
              padding: '16px 20px',
              borderRadius: '2px 16px 16px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <motion.div
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0 }}
              style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }}
            />
            <motion.div
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }}
            />
            <motion.div
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }}
            />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div 
        style={{
          position: 'relative',
          padding: 'var(--space-4) var(--space-4) var(--space-4) var(--space-4)',
          background: 'linear-gradient(to top, var(--bg-void) 70%, transparent 100%)',
          flexShrink: 0
        }}
      >
        {/* Autocomplete Dropdown */}
        <AnimatePresence>
          {autocompleteQuery !== null && autocompleteOptions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 'var(--space-4)',
                right: 'var(--space-4)',
                marginBottom: 'var(--space-2)',
                background: 'var(--bg-glass)',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                border: 'var(--glass-border)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-md)',
                overflow: 'hidden',
                zIndex: 20,
                maxHeight: '200px',
                overflowY: 'auto'
              }}
              className="scrollbar-thin"
            >
              <div 
                style={{
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'rgba(0,0,0,0.2)'
                }}
              >
                Insert Report Reference
              </div>
              {autocompleteOptions.map((opt, idx) => (
                <div
                  key={opt.id}
                  onClick={() => insertAutocomplete(opt)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease',
                    background: idx === autocompleteIndex ? 'var(--accent-dim)' : 'transparent',
                    borderLeft: idx === autocompleteIndex ? '3px solid var(--accent)' : '3px solid transparent'
                  }}
                  onMouseEnter={() => setAutocompleteIndex(idx)}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--accent)', fontWeight: 600 }}>
                    /{opt.display_id}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {opt.title}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="chat-input-container">
          {/* Attachments & Tool Bar */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '4px var(--space-2)',
              flexWrap: 'wrap',
              borderBottom: (attachedReports.length > 0 || showAttachDropdown) ? '1px solid var(--border-subtle)' : 'none',
              paddingBottom: (attachedReports.length > 0 || showAttachDropdown) ? '8px' : '0'
            }}
          >
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowAttachDropdown(!showAttachDropdown)}
                className="btn-pill"
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)'
                }}
              >
                <Paperclip size={13} />
                {t('referenceReports')}
              </button>

              <AnimatePresence>
                {showAttachDropdown && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      marginBottom: '8px',
                      width: '240px',
                      background: 'var(--bg-glass)',
                      backdropFilter: 'var(--glass-blur)',
                      WebkitBackdropFilter: 'var(--glass-blur)',
                      border: 'var(--glass-border)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow: 'var(--shadow-md)',
                      overflow: 'hidden',
                      zIndex: 10,
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}
                    className="scrollbar-thin"
                  >
                    {filteredReports.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                        {t('noReportsAvailable')}
                      </div>
                    ) : (
                      filteredReports.map(report => (
                        <div
                          key={report.id}
                          onClick={() => {
                            setAttachedReports(prev => [...prev, { id: report.id, title: report.title, display_id: report.display_id }]);
                            setShowAttachDropdown(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            color: 'var(--text-primary)',
                            transition: 'all 0.15s ease',
                            borderBottom: '1px solid var(--border-subtle)',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--accent-dim)';
                            e.currentTarget.style.borderLeft = '3px solid var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderLeft = 'none';
                          }}
                        >
                          {report.title} <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>({report.display_id})</span>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {attachedReports.map(report => (
              <div
                key={report.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-pill)',
                  userSelect: 'none'
                }}
              >
                <span>{report.display_id || report.title.substring(0, 15)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachedReport(report.id, report.display_id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* Textarea & Send */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-2) 4px var(--space-2)' }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chatPlaceholder')}
              className="chat-input-textarea"
              rows={1}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || !inputText.trim()}
              className="btn-accent"
              style={{
                width: '38px',
                height: '38px',
                minWidth: '38px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                opacity: (isLoading || !inputText.trim()) ? 0.4 : 1,
                cursor: (isLoading || !inputText.trim()) ? 'not-allowed' : 'pointer'
              }}
              title={t('send')}
            >
              <Send size={15} style={{ marginLeft: inputText.trim() && !isLoading ? '2px' : 0 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
