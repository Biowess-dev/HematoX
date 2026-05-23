import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../hooks/useScrollLock';
import {
  BookOpen,
  Search,
  Bookmark,
  BookmarkCheck,
  MoreVertical,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  AlertTriangle,
  MessageSquare,
  Download,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

const getRelativeTime = (dateStr, language = 'en') => {
  if (!dateStr) return '';
  try {
    const normalizedStr = dateStr.replace(' ', 'T') + 'Z';
    const d = new Date(normalizedStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now - d) / 1000);

    const isFr = language === 'fr';

    if (diffInSeconds < 60) return isFr ? "À l'instant" : 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return isFr 
        ? `Il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`
        : `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return isFr
        ? `Il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`
        : `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return isFr
        ? `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`
        : `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return isFr
        ? `Il y a ${diffInMonths} mois`
        : `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    }
    const diffInYears = Math.floor(diffInDays / 365);
    return isFr
      ? `Il y a ${diffInYears} an${diffInYears > 1 ? 's' : ''}`
      : `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  } catch (e) {
    return dateStr;
  }
};

const Portal = ({ children }) => {
  return createPortal(children, document.body);
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function CasebookPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { isMobile } = useBreakpoint();
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  // Multi-select state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Single report dropdown actions and delete state
  const [menuOpenReportId, setMenuOpenReportId] = useState(null);
  const [singleReportToDelete, setSingleReportToDelete] = useState(null);

  useScrollLock(showDeleteModal || singleReportToDelete !== null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setMenuOpenReportId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const handleMenuToggle = (e, reportId) => {
    e.stopPropagation();
    setMenuOpenReportId(prev => prev === reportId ? null : reportId);
  };

  const handleExportPDF = async (reportId) => {
    const loadingToast = toast.loading(language === 'fr' ? "Génération du PDF..." : "Generating PDF...");
    try {
      const reportRes = await apiClient.get(`/reports/${reportId}`);
      const reportData = reportRes.data;
      
      const response = await apiClient.post(
        '/export/pdf',
        {
          markdown: reportData.generated_report,
          title: reportData.title || 'Report',
          patient_name: reportData.patient_name || '',
          display_id: reportData.display_id || '',
          module_type: reportData.module_type || ''
        },
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const filename = `hematox_${reportData.display_id || 'report'}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'fr' ? "PDF exporté" : "PDF exported", { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error(language === 'fr' ? "Échec de l'export PDF" : "PDF generation failed", { id: loadingToast });
    }
  };

  const handleExportMarkdown = async (reportId) => {
    const loadingToast = toast.loading(language === 'fr' ? "Génération du Markdown..." : "Generating Markdown...");
    try {
      const reportRes = await apiClient.get(`/reports/${reportId}`);
      const reportData = reportRes.data;
      
      const date = new Date().toISOString().slice(0, 10);
      const text = `# ${reportData.module_type?.toUpperCase()} Report\n**Report ID:** ${reportData.display_id}\n**Patient:** ${reportData.patient_name}\n\n---\n\n${reportData.generated_report}`;
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportData.display_id || 'report'}_${date}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'fr' ? "Markdown exporté" : "Markdown exported", { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error(language === 'fr' ? "Échec de l'export Markdown" : "Markdown generation failed", { id: loadingToast });
    }
  };

  const handleDeleteSingle = async (id) => {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/reports/${id}`);
      setReports(prev => prev.filter(r => r.id !== id));
      setSingleReportToDelete(null);
      toast.success(language === 'fr' ? "Rapport supprimé" : "Report deleted");
    } catch (error) {
      console.error("Delete error", error);
      toast.error(language === 'fr' ? "Échec de la suppression du rapport" : "Failed to delete report");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    apiClient.get('/reports')
      .then(response => {
        setReports(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching reports:', error);
        toast.error(t('failedToLoadReports') || "Failed to load reports");
        setLoading(false);
      });
  }, [t]);

  const handleBookmarkToggle = (e, report) => {
    e.stopPropagation();
    const newBookmarkStatus = report.is_bookmarked === 1 ? 0 : 1;

    apiClient.post(`/reports/${report.id}`, { is_bookmarked: newBookmarkStatus })
      .then(() => {
        setReports(prevReports =>
          prevReports.map(r =>
            r.id === report.id ? { ...r, is_bookmarked: newBookmarkStatus } : r
          )
        );
        toast.success(newBookmarkStatus === 1 ? t('reportBookmarked') || "Report bookmarked" : t('bookmarkRemoved') || "Bookmark removed");
      })
      .catch(error => {
        console.error('Error updating bookmark:', error);
        toast.error(t('failedToUpdateBookmark') || "Failed to update bookmark");
      });
  };

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelect(!isMultiSelect);
    setSelectedIds(new Set()); // clear selection on toggle
  };

  const handleCardClick = (report) => {
    if (isMultiSelect) {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(report.id)) {
        newSelection.delete(report.id);
      } else {
        newSelection.add(report.id);
      }
      setSelectedIds(newSelection);
    } else {
      navigate(`/casebook/${report.id}`);
    }
  };

  const handleBookmarkAllSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const promises = ids.map(id => apiClient.post(`/reports/${id}`, { is_bookmarked: 1 }));
    toast.promise(Promise.all(promises), {
      loading: language === 'fr' ? 'Ajout des rapports aux favoris...' : 'Bookmarking reports...',
      success: () => {
        setReports(prev => prev.map(r => ids.includes(r.id) ? { ...r, is_bookmarked: 1 } : r));
        return language === 'fr' ? `${ids.length} rapport(s) ajouté(s) aux favoris` : `${ids.length} report(s) bookmarked`;
      },
      error: language === 'fr' ? 'Échec de la mise en favoris de certains rapports' : 'Failed to bookmark some reports'
    });
  };

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    const ids = Array.from(selectedIds);

    try {
      await Promise.all(ids.map(id => apiClient.delete(`/reports/${id}`)));
      setReports(prev => prev.filter(r => !ids.includes(r.id)));
      setSelectedIds(new Set());
      setIsMultiSelect(false);
      setShowDeleteModal(false);
      toast.success(language === 'fr' ? `${ids.length} rapport(s) supprimé(s)` : `${ids.length} report(s) deleted`);
    } catch (error) {
      console.error("Delete error", error);
      toast.error("Failed to delete some reports");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReferenceToChat = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    navigate(`/chat?attachReports=${ids.join(',')}`);
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (moduleFilter !== "All" && moduleFilter !== "Bookmarked") {
        const filterType = moduleFilter === "Coagulation" ? "coag" : moduleFilter.toLowerCase();
        if (r.module_type !== filterType) {
          return false;
        }
      }
      if (moduleFilter === "Bookmarked") {
        if (r.is_bookmarked !== 1) {
          return false;
        }
      }
      if (search) {
        if (!r.title.toLowerCase().includes(search.toLowerCase()) &&
          !(r.patient_name && r.patient_name.toLowerCase().includes(search.toLowerCase()))) {
          return false;
        }
      }
      return true;
    });
  }, [reports, moduleFilter, search]);

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 16px' : '0', paddingBottom: isMultiSelect ? (isMobile ? '160px' : '100px') : (isMobile ? '40px' : '0') }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '16px' : '0px',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        marginBottom: '32px'
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
            <BookOpen size={20} strokeWidth={2.2} />
          </div>
          <h1 className="text-page-title" style={{ margin: 0 }}>
            {t('casebook')}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
          <button
            className="btn-pill"
            onClick={toggleMultiSelectMode}
            style={{
              background: isMultiSelect ? 'var(--accent)' : '',
              color: isMultiSelect ? '#fff' : '',
              borderColor: isMultiSelect ? 'var(--accent)' : '',
              flex: isMobile ? 1 : 'none',
              justifyContent: 'center'
            }}
          >
            {isMultiSelect ? t('cancel') : t('select')}
          </button>
          <button className="btn-accent" onClick={() => navigate('/')} style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center' }}>
            <Plus size={16} />
            {t('newAnalysis')}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        marginBottom: 'var(--space-6)',
        gap: 'var(--space-4)'
      }}>
        {/* Mobile search bar on top */}
        {isMobile && (
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="input-glass"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              style={{
                width: '100%',
                paddingLeft: '36px'
              }}
            />
          </div>
        )}

        {/* Pills */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          background: 'var(--bg-elevated)',
          padding: '6px',
          borderRadius: isMobile ? '12px' : 'var(--radius-pill)',
          border: '1px solid var(--border-dim)',
          overflowX: isMobile ? 'auto' : 'visible',
          width: isMobile ? '100%' : 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {["All", "CBC", "Coagulation", "ROTEM", "Bookmarked"].map((pill) => {
            const isActive = moduleFilter === pill;
            const displayLabel = 
              pill === "All" ? (language === "fr" ? "Tous" : "All") :
              pill === "Bookmarked" ? (language === "fr" ? "Favoris" : "Bookmarked") :
              pill === "CBC" ? t('cbc') :
              pill === "Coagulation" ? t('coagulation') :
              pill === "ROTEM" ? t('rotem') : pill;

            return (
              <button
                key={pill}
                onClick={() => setModuleFilter(pill)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  outline: 'none',
                  flexShrink: 0
                }}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>

        {/* Desktop search bar on right */}
        {!isMobile && (
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="input-glass"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              style={{
                width: '260px',
                paddingLeft: '36px'
              }}
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '64px' }}>
          <div className="spinner"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '9999px',
              marginBottom: 'var(--space-6)',
              flexShrink: 0
            }}
          >
            <BookOpen
              size={40}
              strokeWidth={2}
              style={{ color: 'var(--text-secondary)' }}
            />
          </div>
          <h2 className="text-section-hd" style={{ marginBottom: 'var(--space-2)' }}>{t('noReportsFound')}</h2>
          <p className="text-body" style={{ marginBottom: 'var(--space-6)' }}>
            {reports.length === 0
              ? t('runAnalysisToSave')
              : t('adjustFiltersOrSearch')}
          </p>
          <button className="btn-accent btn-pill" onClick={() => navigate('/')}>
            {t('goToDashboard')}
          </button>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredReports.map((report) => (
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              key={report.id}
              onClick={() => handleCardClick(report)}
              className="glass-card"
              style={{
                padding: 'var(--space-5)',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                borderColor: isMultiSelect && selectedIds.has(report.id) ? 'var(--accent)' : '',
                backgroundColor: isMultiSelect && selectedIds.has(report.id) ? 'var(--accent-dim)' : ''
              }}
            >
              {/* Top Row: Checkbox/ID + Module Chip + Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isMultiSelect && (
                    <div onClick={(e) => toggleSelection(e, report.id)} style={{ color: selectedIds.has(report.id) ? 'var(--accent)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                      {selectedIds.has(report.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                  )}
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {report.display_id || `REP-${report.id.toString().padStart(4, '0')}`}
                  </span>
                  <span className="text-badge" style={{
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-glow)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--accent-dim)'
                  }}>
                    {report.module_type === 'cbc' ? t('cbc') : report.module_type === 'coag' ? t('coagulation') : report.module_type?.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={(e) => handleBookmarkToggle(e, report)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: report.is_bookmarked === 1 ? '#f59e0b' : 'var(--text-secondary)',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {report.is_bookmarked === 1 ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => handleMenuToggle(e, report.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: menuOpenReportId === report.id ? 'var(--accent)' : 'var(--text-secondary)',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'color 0.2s ease, background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (menuOpenReportId !== report.id) e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        if (menuOpenReportId !== report.id) e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                    
                    <AnimatePresence>
                      {menuOpenReportId === report.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -5 }}
                          transition={{ duration: 0.12 }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            background: 'var(--bg-glass)',
                            backdropFilter: 'var(--glass-blur)',
                            WebkitBackdropFilter: 'var(--glass-blur)',
                            border: 'var(--glass-border)',
                            borderRadius: 'var(--radius-input)',
                            boxShadow: 'var(--shadow-md)',
                            padding: '6px',
                            minWidth: '170px',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportMarkdown(report.id);
                              setMenuOpenReportId(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Download size={14} />
                            <span>{t('exportMarkdown')}</span>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPDF(report.id);
                              setMenuOpenReportId(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <FileText size={14} />
                            <span>{t('exportPdf')}</span>
                          </button>
                          
                          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSingleReportToDelete(report);
                              setMenuOpenReportId(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              color: '#ef4444',
                              fontSize: '13px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Trash2 size={14} />
                            <span>{t('delete')}</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Title & Patient */}
              <div>
                <h3 className="text-card-title" style={{ margin: '0 0 var(--space-1) 0', lineHeight: 1.4 }}>
                  {report.title}
                </h3>
                {report.patient_name && (
                  <p className="text-body" style={{ margin: 0, fontStyle: 'italic' }}>
                    {report.patient_name}
                  </p>
                )}
              </div>

              {/* Footer: Date */}
              <div style={{ marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
                <span className="text-caption">
                  {getRelativeTime(report.created_at, language)}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Multi-Select Actions Bar */}
      <AnimatePresence>
        {isMultiSelect && selectedIds.size > 0 && (
          <Portal key="multi-select-actions-bar">
            <motion.div
              initial={{ y: 100, opacity: 0, x: '-50%' }}
              animate={{ y: 0, opacity: 1, x: '-50%' }}
              exit={{ y: 100, opacity: 0, x: '-50%' }}
              style={{
                position: 'fixed',
                bottom: '16px',
                left: isMobile ? '50%' : 'calc(50% + var(--sidebar-width, 0px) / 2)',
                background: 'var(--bg-glass)',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                border: 'var(--glass-border)',
                borderRadius: '16px',
                padding: isMobile ? '12px 16px' : '12px 24px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                gap: isMobile ? '12px' : '24px',
                width: isMobile ? 'calc(100% - 32px)' : 'auto',
                boxShadow: 'var(--shadow-md)',
                zIndex: 100,
                transition: 'left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background-color 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: isMobile ? '100%' : 'auto', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px' }}>
                  {selectedIds.size} {t('selected')}
                </span>
                {isMobile && (
                  <button className="btn-pill" onClick={() => setSelectedIds(new Set())} style={{ padding: '4px 8px', fontSize: '11px' }}>
                    Deselect All
                  </button>
                )}
              </div>
              {!isMobile && <div style={{ height: '24px', width: '1px', background: 'var(--border-dim)' }}></div>}
              <div style={{ display: 'flex', gap: 'var(--space-2)', width: isMobile ? '100%' : 'auto', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <button
                  className="btn-pill"
                  onClick={handleReferenceToChat}
                  style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}
                  title={t('referenceToChat')}
                >
                  <MessageSquare size={14} />
                  {!isMobile && t('referenceToChat')}
                </button>
                <button
                  className="btn-pill"
                  onClick={handleBookmarkAllSelected}
                  style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}
                  title={t('bookmarkAll')}
                >
                  <Bookmark size={14} />
                  {!isMobile && t('bookmarkAll')}
                </button>
                <button
                  className="btn-accent btn-pill"
                  onClick={() => setShowDeleteModal(true)}
                  style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}
                  title={t('deleteSelected')}
                >
                  <Trash2 size={14} />
                  {!isMobile && t('deleteSelected')}
                </button>
              </div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {(showDeleteModal || singleReportToDelete !== null) && (
          <Portal key="delete-confirmation-modal">
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
              onClick={() => {
                if (!isDeleting) {
                  setShowDeleteModal(false);
                  setSingleReportToDelete(null);
                }
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
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
                    {singleReportToDelete !== null
                      ? (language === 'fr' ? 'Supprimer le rapport ?' : 'Delete Report?')
                      : t('deleteReportsModalTitle')}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                    {singleReportToDelete !== null
                      ? (language === 'fr'
                          ? `Êtes-vous sûr de vouloir supprimer "${singleReportToDelete.title}" ? Cette action est irréversible.`
                          : `Are you sure you want to delete "${singleReportToDelete.title}"? This action cannot be undone.`)
                      : t('deleteReportsModalMessage')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                  <button
                    className="btn-pill"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => {
                      setShowDeleteModal(false);
                      setSingleReportToDelete(null);
                    }}
                    disabled={isDeleting}
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
                    onClick={() => {
                      if (singleReportToDelete !== null) {
                        handleDeleteSingle(singleReportToDelete.id);
                      } else {
                        handleDeleteSelected();
                      }
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (language === 'fr' ? 'Suppression...' : 'Deleting...') : t('delete')}
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
