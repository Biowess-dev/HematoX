import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Loader2, Download, FileText, Bookmark, Pencil, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

export default function ReportOutput({
  markdown,
  displayId,
  patientName,
  moduleType,
  reportId,
  onSaveToCasebook,
  hideActions = false
}) {
  const { language, t } = useLanguage();
  const { isMobile } = useBreakpoint();
  const [currentMarkdown, setCurrentMarkdown] = useState(markdown);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(markdown);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    setCurrentMarkdown(markdown);
    setEditText(markdown);
  }, [markdown]);

  const handleCopy = () => {
    if (!currentMarkdown) return;
    navigator.clipboard.writeText(currentMarkdown);
    setCopied(true);
    toast.success(t('copied') || "Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!currentMarkdown) return;
    const date = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toISOString().slice(11, 16);
    const datetime = `${date} ${timeStr} UTC`;

    const mType = (moduleType || 'cbc').toUpperCase();
    const patName = patientName || "Anonymous";
    const disp = displayId || "Report";

    const exportedText = `# ${mType} Report
**Report ID:** ${disp}
**Patient:** ${patName}
**Generated:** ${datetime}
**System:** BIOWESS 2026 · Educational Use Only

---

${currentMarkdown}`;

    const blob = new Blob([exportedText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${disp}_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('markdownExported') || "Markdown exported");
  };

  const handleExportPDF = async () => {
    if (!currentMarkdown) return;
    setPdfLoading(true);
    try {
      const response = await apiClient.post(
        '/export/pdf',
        {
          markdown: currentMarkdown,
          title: `${(moduleType || 'cbc').toUpperCase()} Report`,
          patient_name: patientName || "",
          display_id: displayId || "",
          module_type: moduleType || ""
        },
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const filename = `hematox_${displayId || 'report'}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'fr' ? "PDF exporté avec succès" : "PDF exported successfully");
    } catch (err) {
      console.error(err);
      toast.error(language === 'fr' ? "Échec de la génération du PDF" : "PDF generation failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSaveEdits = () => {
    setCurrentMarkdown(editText);
    setIsEditing(false);
    toast.success(language === 'fr' ? "Modifications enregistrées localement" : "Edits saved locally");
  };

  const handleCancelEdits = () => {
    setEditText(currentMarkdown);
    setIsEditing(false);
  };

  const getModuleBadgeStyles = () => {
    const type = (moduleType || '').toLowerCase();
    if (type === 'cbc') {
      return {
        backgroundColor: 'var(--accent)',
        color: '#ffffff',
        border: '1px solid var(--accent-hover)'
      };
    } else if (type === 'coag' || type === 'coagulation') {
      return {
        backgroundColor: '#B45309',
        color: '#fef3c7',
        border: '1px solid #92400e'
      };
    } else if (type === 'rotem') {
      return {
        backgroundColor: '#065F46',
        color: '#d1fae5',
        border: '1px solid #047857'
      };
    }
    return {
      backgroundColor: 'var(--bg-elevated)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-subtle)'
    };
  };

  if (!currentMarkdown) {
    return (
      <div className="glass-card" style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: 'var(--text-secondary)' }}>
        {t('noReportGenerated') || "No report generated yet."}
      </div>
    );
  }

  const showHeader = (displayId || patientName || !hideActions);

  return (
    <div className="glass-card" style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      gap: showHeader ? '20px' : '0px',
      position: 'relative',
      overflow: 'hidden',
      height: '100%'
    }}>
      {/* Header Bar */}
      {showHeader && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {displayId && (
              <span style={{
                ...getModuleBadgeStyles(),
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                {displayId}
              </span>
            )}
            {patientName && (
              <span style={{
                color: 'var(--text-primary)',
                fontWeight: 500,
                fontSize: '14px'
              }}>
                {t('patient') || "Patient"}: {patientName}
              </span>
            )}
          </div>

          {!hideActions && (
            isMobile ? (
              <div style={{ position: 'relative' }} ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="btn-accent btn-pill"
                  style={{
                    padding: '6px 16px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    fontSize: '13px'
                  }}
                >
                  <span>Actions</span>
                  <ChevronDown size={14} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 8px)',
                        background: 'var(--bg-glass)',
                        backdropFilter: 'var(--glass-blur)',
                        WebkitBackdropFilter: 'var(--glass-blur)',
                        border: 'var(--glass-border)',
                        borderRadius: '12px',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        zIndex: 100,
                        minWidth: '180px',
                        boxShadow: 'var(--shadow-lg)'
                      }}
                    >
                      {/* Copy */}
                      <button
                        onClick={() => { handleCopy(); setMenuOpen(false); }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-primary)',
                          padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                          textAlign: 'left', width: '100%', transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        <span>{copied ? t('copied') : t('copyReport')}</span>
                      </button>

                      {/* PDF Export */}
                      <button
                        onClick={() => { handleExportPDF(); setMenuOpen(false); }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-primary)',
                          padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                          textAlign: 'left', width: '100%', transition: 'background 0.2s',
                          opacity: pdfLoading ? 0.5 : 1
                        }}
                        disabled={pdfLoading}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        {pdfLoading ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex' }}>
                            <Loader2 size={14} />
                          </motion.div>
                        ) : (
                          <FileText size={14} />
                        )}
                        <span>{pdfLoading ? (language === 'fr' ? 'Exportation...' : 'Exporting...') : t('exportPdf')}</span>
                      </button>

                      {/* Export Markdown */}
                      <button
                        onClick={() => { handleExportMarkdown(); setMenuOpen(false); }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-primary)',
                          padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                          textAlign: 'left', width: '100%', transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <Download size={14} />
                        <span>{t('exportMarkdown')}</span>
                      </button>

                      {/* Save to Casebook */}
                      {onSaveToCasebook && (
                        <button
                          onClick={() => { onSaveToCasebook(currentMarkdown); setMenuOpen(false); }}
                          style={{
                            background: 'none', border: 'none', color: 'var(--accent)',
                            padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                            textAlign: 'left', width: '100%', transition: 'background 0.2s',
                            fontWeight: 500
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-dim)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <Bookmark size={14} />
                          <span>{t('saveToCasebook')}</span>
                        </button>
                      )}

                      {/* Divider */}
                      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

                      {/* Edit */}
                      {!isEditing && (
                        <button
                          onClick={() => { setIsEditing(true); setMenuOpen(false); }}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-primary)',
                            padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                            textAlign: 'left', width: '100%', transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <Pencil size={14} />
                          <span>{t('editReport')}</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Copy Report Button */}
                <button
                  onClick={handleCopy}
                  className="btn-pill"
                  style={{ 
                    padding: '6px 12px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px'
                  }}
                  title={t('copyReport')}
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span style={{ fontSize: '12px' }}>{copied ? t('copied') : t('copyReport')}</span>
                </button>

                {/* Export PDF Button */}
                <button
                  onClick={handleExportPDF}
                  className="btn-pill"
                  style={{ 
                    padding: '6px 12px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    opacity: pdfLoading ? 0.5 : 1,
                    cursor: pdfLoading ? 'not-allowed' : 'pointer'
                  }}
                  disabled={pdfLoading}
                  title={t('exportPdf')}
                >
                  {pdfLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex' }}>
                      <Loader2 size={14} />
                    </motion.div>
                  ) : (
                    <FileText size={14} />
                  )}
                  <span style={{ fontSize: '12px' }}>{pdfLoading ? (language === 'fr' ? 'Exportation...' : 'Exporting...') : t('exportPdf')}</span>
                </button>

                {/* Export Markdown Button */}
                <button
                  onClick={handleExportMarkdown}
                  className="btn-pill"
                  style={{ 
                    padding: '6px 12px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px'
                  }}
                  title={t('exportMarkdown')}
                >
                  <Download size={14} />
                  <span style={{ fontSize: '12px' }}>{t('exportMarkdown')}</span>
                </button>

                {/* Save to Casebook Button */}
                {onSaveToCasebook && (
                  <button
                    onClick={() => onSaveToCasebook(currentMarkdown)}
                    className="btn-accent btn-pill"
                    style={{ 
                      padding: '6px 12px', 
                      height: '32px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px'
                    }}
                    title={t('saveToCasebook')}
                  >
                    <Bookmark size={14} />
                    <span style={{ fontSize: '12px' }}>{t('saveToCasebook')}</span>
                  </button>
                )}

                {/* Edit Report Button */}
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-pill"
                    style={{ 
                      padding: '6px 12px', 
                      height: '32px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px'
                    }}
                    title={t('editReport')}
                  >
                    <Pencil size={14} />
                    <span style={{ fontSize: '12px' }}>{t('editReport')}</span>
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* Body Area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="input-glass"
              style={{
                flex: 1,
                minHeight: '350px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                lineHeight: '1.6',
                resize: 'vertical',
                padding: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleCancelEdits} className="btn-pill" style={{ padding: '8px 16px' }}>
                {t('cancel')}
              </button>
              <button onClick={handleSaveEdits} className="btn-accent" style={{ padding: '8px 16px' }}>
                {t('saveChanges')}
              </button>
            </div>
          </div>
        ) : (
          <div className="markdown-content scrollbar-thin" style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 'var(--text-body)',
            lineHeight: '1.8',
            color: 'var(--text-primary)',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 280px)',
            paddingRight: 'var(--space-2)',
            paddingBottom: 'var(--space-10)'
          }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="markdown-table-wrapper">
                    <table className="markdown-table" {...props} />
                  </div>
                ),
                th: ({ node, ...props }) => <th {...props} />,
                td: ({ node, ...props }) => <td {...props} />,
                h1: ({ node, ...props }) => (
                  <h1 style={{ fontSize: '1.5em', fontWeight: 700, marginTop: '24px', marginBottom: '12px', color: 'var(--text-primary)' }} {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 style={{
                    fontSize: '1.2em',
                    fontWeight: 700,
                    marginTop: '20px',
                    marginBottom: '12px',
                    color: 'var(--text-primary)',
                    borderLeft: '4px solid var(--accent)',
                    background: 'var(--accent-dim)',
                    padding: '6px 12px',
                    borderRadius: '0 4px 4px 0'
                  }} {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 style={{ fontSize: '1.1em', fontWeight: 700, marginTop: '16px', marginBottom: '8px', color: 'var(--text-primary)' }} {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p style={{ marginTop: '0', marginBottom: '16px', color: 'var(--text-secondary)' }} {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul style={{ marginTop: '0', marginBottom: '16px', paddingLeft: '24px' }} {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol style={{ marginTop: '0', marginBottom: '16px', paddingLeft: '24px' }} {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li style={{ marginBottom: '6px', color: 'var(--text-secondary)' }} {...props} />
                )
              }}
            >
              {currentMarkdown}
            </ReactMarkdown>

          </div>
        )}
      </div>
    </div>
  );
}
