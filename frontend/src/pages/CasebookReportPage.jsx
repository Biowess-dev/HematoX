import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, Download, MessageSquare, 
  Pencil, Trash2, Bookmark, BookmarkCheck, Check, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';
import ReportOutput from '../components/ReportOutput';
import { useLanguage } from '../context/LanguageContext';

export default function CasebookReportPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!report?.generated_report) return;
    navigator.clipboard.writeText(report.generated_report);
    setCopied(true);
    toast.success(t('copied') || "Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = () => {
    setLoading(true);
    apiClient.get(`/reports/${reportId}`)
      .then(res => {
        setReport(res.data);
        setEditText(res.data.generated_report);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.error(t('failedToFetchReport') || "Failed to fetch report");
        setLoading(false);
      });
  };

  const handleBookmarkToggle = () => {
    const newStatus = report.is_bookmarked ? 0 : 1;
    apiClient.post(`/reports/${reportId}`, { is_bookmarked: newStatus })
      .then(() => {
        setReport({ ...report, is_bookmarked: newStatus });
        toast.success(newStatus ? (t('reportBookmarked') || "Bookmarked") : (t('bookmarkRemoved') || "Bookmark removed"));
      })
      .catch(err => {
        console.error(err);
        toast.error(t('failedToUpdateBookmark') || "Failed to update bookmark");
      });
  };

  const handleExportPDF = async () => {
    if (!report?.generated_report) return;
    setPdfLoading(true);
    try {
      const response = await apiClient.post(
        '/export/pdf',
        {
          markdown: report.generated_report,
          title: report.title || 'Report',
          patient_name: report.patient_name || '',
          display_id: report.display_id || '',
          module_type: report.module_type || ''
        },
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const filename = `hematox_${report.display_id || 'report'}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'fr' ? "PDF exporté" : "PDF exported");
    } catch (err) {
      console.error(err);
      toast.error(language === 'fr' ? "Échec de l'export PDF" : "PDF generation failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!report?.generated_report) return;
    const date = new Date().toISOString().slice(0, 10);
    const text = `# ${report.module_type?.toUpperCase()} Report\n**Report ID:** ${report.display_id}\n**Patient:** ${report.patient_name}\n\n---\n\n${report.generated_report}`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.display_id || 'report'}_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(language === 'fr' ? "Markdown exporté" : "Markdown exported");
  };

  const handleInjectChat = () => {
    navigate(`/chat?attachReport=${reportId}`);
  };

  const handleSaveEdits = () => {
    apiClient.post(`/reports/${reportId}`, { generated_report: editText })
      .then(() => {
        setReport({ ...report, generated_report: editText });
        setIsEditing(false);
        toast.success(t('saveSuccess') || "Changes saved");
      })
      .catch(err => {
        console.error(err);
        toast.error(t('saveFailed') || "Failed to save changes");
      });
  };

  const handleDelete = () => {
    setIsDeleting(true);
    apiClient.delete(`/reports/${reportId}`)
      .then(() => {
        toast.success(t('reportDeleted') || "Report deleted");
        navigate('/casebook');
      })
      .catch(err => {
        console.error(err);
        toast.error(t('failedToDeleteReport') || "Failed to delete report");
        setIsDeleting(false);
        setShowDeleteConfirm(false);
      });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '64px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ textAlign: 'center', marginTop: '64px', color: 'var(--text-secondary)' }}>
        {t('reportNotFound') || "Report not found."}
        <br/><br/>
        <button className="btn-glass" onClick={() => navigate('/casebook')}>{t('goBack') || "Go Back"}</button>
      </div>
    );
  }

  const dateStr = new Date(report.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');

  return (
    <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Back Button */}
      <button 
        className="btn-pill" 
        onClick={() => navigate('/casebook')}
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', border: 'none', background: 'transparent' }}
      >
        <ArrowLeft size={18} />
        {t('backToCasebook') || "Back to Casebook"}
      </button>

      {/* Full-width glass card */}
      <div className="glass-card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span className="text-caption" style={{ 
                background: 'var(--bg-elevated)', 
                padding: 'var(--space-1) var(--space-2)', 
                borderRadius: 'var(--radius-input)', 
                fontFamily: 'var(--font-mono)', 
                color: 'var(--text-secondary)'
              }}>
                {report.display_id}
              </span>
              <span className="text-badge" style={{
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-glow)',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-input)',
              }}>
                {report.module_type === 'cbc' ? t('cbc') : report.module_type === 'coag' ? t('coagulation') : report.module_type?.toUpperCase()}
              </span>
              <button 
                onClick={handleBookmarkToggle}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  color: report.is_bookmarked ? '#f59e0b' : 'var(--text-secondary)'
                }}
              >
                {report.is_bookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              </button>
            </div>
            
            <h1 className="text-page-title" style={{ margin: 0, color: 'var(--text-primary)' }}>
              {report.title}
            </h1>
            <div className="text-body" style={{ color: 'var(--text-secondary)', display: 'flex', gap: 'var(--space-4)' }}>
              {report.patient_name && <span>{t('patient') || "Patient"}: {report.patient_name}</span>}
              <span>{dateStr}</span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ 
          display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', 
          borderTop: '1px solid var(--border-dim)', 
          borderBottom: '1px solid var(--border-dim)',
          padding: 'var(--space-3) 0'
        }}>
          <button className="btn-pill" onClick={handleCopy} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            {copied ? t('copied') : t('copyReport')}
          </button>
          <button className="btn-pill" onClick={handleExportPDF} disabled={pdfLoading} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <FileText size={16} /> {pdfLoading ? (language === 'fr' ? 'Exportation...' : 'Exporting...') : t('exportPdf')}
          </button>
          <button className="btn-pill" onClick={handleExportMarkdown} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Download size={16} /> {t('exportMarkdown')}
          </button>
          <button className="btn-pill" onClick={handleInjectChat} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <MessageSquare size={16} /> {t('injectIntoChat')}
          </button>
          <button className="btn-pill" onClick={() => setIsEditing(!isEditing)} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Pencil size={16} /> {isEditing ? t('cancel') : t('editReport')}
          </button>
          
          <div style={{ flex: 1 }}></div>

          {showDeleteConfirm ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span className="text-caption" style={{ color: '#ef4444' }}>{language === 'fr' ? 'Êtes-vous sûr ?' : 'Are you sure?'}</span>
              <button className="btn-pill" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>{t('cancel')}</button>
              <button 
                className="btn-accent btn-pill" 
                style={{ background: '#ef4444', borderColor: '#ef4444' }} 
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (language === 'fr' ? 'Suppression...' : 'Deleting...') : (language === 'fr' ? 'Oui, Supprimer' : 'Yes, Delete')}
              </button>
            </div>
          ) : (
            <button 
              className="btn-pill" 
              onClick={() => setShowDeleteConfirm(true)} 
              style={{ display: 'flex', gap: 'var(--space-2)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <Trash2 size={16} /> {t('delete')}
            </button>
          )}
        </div>

        {/* Body Area */}
        <div style={{ marginTop: 'var(--space-2)' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="input-glass"
                style={{
                  minHeight: '600px',
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-body)',
                  lineHeight: 1.6,
                  padding: 'var(--space-4)',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button className="btn-pill" onClick={() => { setEditText(report.generated_report); setIsEditing(false); }}>
                  {t('cancel')}
                </button>
                <button className="btn-accent btn-pill" onClick={handleSaveEdits}>
                  {t('saveChanges')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-card)', padding: 'var(--space-4)' }}>
              <ReportOutput 
                markdown={report.generated_report} 
                reportId={report.id}
                hideActions={true}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
