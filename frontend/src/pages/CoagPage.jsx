import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../hooks/useScrollLock';
import { Activity, AlertCircle, ArrowLeft, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import ReportOutput from '../components/ReportOutput';
import ErrorBanner from '../components/ErrorBanner';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useLanguage } from '../context/LanguageContext';
import './CBCPage.css'; // Reuse the same CSS since it provides the structural classes

export default function CoagPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isServiceDown, setIsServiceDown] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [reportId, setReportId] = useState(null);
  const [displayId, setDisplayId] = useState(null);
  
  const { isMobile } = useBreakpoint();
  const [showOutputMobile, setShowOutputMobile] = useState(false);

  useScrollLock(isMobile && showOutputMobile);

  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("");

  const [pt, setPt] = useState("");
  const [ptActivity, setPtActivity] = useState("");
  const [inr, setInr] = useState("");
  const [aptt, setAptt] = useState("");
  const [apttRatio, setApttRatio] = useState("");

  const [fibrinogen, setFibrinogen] = useState("");
  const [thrombinTime, setThrombinTime] = useState("");
  const [dDimer, setDDimer] = useState("");

  const parseNumber = (value) => {
    return value === "" ? null : parseFloat(value);
  };

  const handleSubmit = async () => {
    const parsedPt = parseNumber(pt);
    const parsedPtActivity = parseNumber(ptActivity);
    const parsedInr = parseNumber(inr);
    const parsedAptt = parseNumber(aptt);
    const parsedApttRatio = parseNumber(apttRatio);
    const parsedFibrinogen = parseNumber(fibrinogen);
    const parsedThrombinTime = parseNumber(thrombinTime);
    const parsedDDimer = parseNumber(dDimer);

    if (
      parsedPt === null &&
      parsedPtActivity === null &&
      parsedInr === null &&
      parsedAptt === null &&
      parsedApttRatio === null &&
      parsedFibrinogen === null &&
      parsedThrombinTime === null &&
      parsedDDimer === null
    ) {
      setError("Please enter at least one coagulation value");
      return;
    }

    setLoading(true);
    setMarkdown("");
    setReportId(null);
    setDisplayId(null);
    setError(null);
    setIsServiceDown(false);
    if (isMobile) {
      setShowOutputMobile(true);
    }

    const payload = {
      language,
      patient_name: patientName || null,
      pt: parsedPt,
      pt_activity: parsedPtActivity,
      inr: parsedInr,
      aptt: parsedAptt,
      aptt_ratio: parsedApttRatio,
      fibrinogen: parsedFibrinogen,
      thrombin_time: parsedThrombinTime,
      d_dimer: parsedDDimer,
      patient_age: parseNumber(patientAge),
      patient_sex: patientSex === "" ? null : patientSex
    };

    try {
      const response = await apiClient.post('/analyze/coag', payload);
      const { markdown, report_id, display_id, save_error } = response.data;
      setMarkdown(markdown);
      setReportId(report_id);
      setDisplayId(display_id);
      toast.success("Analysis complete");
      if (save_error) toast.error(save_error);
    } catch (err) {
      console.error(err);
      if (err.isServiceUnavailable) {
        setIsServiceDown(true);
      } else {
        setError(err.response?.data?.detail || err.message || "An error occurred during coagulation analysis.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (markdown) {
      navigator.clipboard.writeText(markdown);
      toast.success("Copied to clipboard");
    }
  };

  const handleSaveToCasebook = async (latestMarkdown) => {
    if (!reportId) return;
    try {
      await apiClient.post(`/reports/${reportId}`, {
        is_saved: 1,
        generated_report: latestMarkdown || markdown
      });
      toast.success("Saved to Casebook");
    } catch (error) {
      toast.error("Failed to save to casebook");
    }
  };

  const headerTitle = `${displayId || "Report"} — Coagulation Analysis${patientName ? ` (${patientName})` : ''}`;

  return (
    <div className="cbc-page">
      {/* Left Form Panel */}
      {(!isMobile || !showOutputMobile) && (
        <div className={`cbc-form-panel glass-card`}>
          <h1 className="text-page-title" style={{ margin: '0 0 var(--space-6) 0' }}>{t('coagulationAnalyzer')}</h1>
          
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label className="input-label">{t('patientName')}</label>
            <input 
              type="text" 
              className="input-glass" 
              value={patientName} 
              onChange={(e) => setPatientName(e.target.value)} 
              placeholder="John Doe"
            />
          </div>

          <h3 className="group-heading">{t('patientContext')}</h3>
          <div className="input-grid">
            <div>
              <label className="input-label">{t('age')}</label>
              <input type="number" className="input-glass" value={patientAge} onChange={(e)=>setPatientAge(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('sex')}</label>
              <select className="input-glass" value={patientSex} onChange={(e)=>setPatientSex(e.target.value)}>
                <option value="">{t('unspecified')}</option>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </div>
          </div>

          <h3 className="group-heading">{t('clottingTimes')}</h3>
          <div className="input-grid">
            <div>
              <label className="input-label">{t('pt')}</label>
              <input type="number" step="any" className="input-glass" value={pt} onChange={(e)=>setPt(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('ptActivity')}</label>
              <input type="number" step="any" className="input-glass" value={ptActivity} onChange={(e)=>setPtActivity(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('inr')}</label>
              <input type="number" step="any" className="input-glass" value={inr} onChange={(e)=>setInr(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('aptt')}</label>
              <input type="number" step="any" className="input-glass" value={aptt} onChange={(e)=>setAptt(e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">{t('apttRatio')}</label>
              <input type="number" step="any" className="input-glass" value={apttRatio} onChange={(e)=>setApttRatio(e.target.value)} />
            </div>
          </div>

          <h3 className="group-heading">{t('fibrinSystem')}</h3>
          <div className="input-grid">
            <div>
              <label className="input-label">{t('fibrinogen')}</label>
              <input type="number" step="any" className="input-glass" value={fibrinogen} onChange={(e)=>setFibrinogen(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('thrombinTime')}</label>
              <input type="number" step="any" className="input-glass" value={thrombinTime} onChange={(e)=>setThrombinTime(e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">{t('dDimer')}</label>
              <input type="number" step="any" className="input-glass" value={dDimer} onChange={(e)=>setDDimer(e.target.value)} />
            </div>
          </div>

          <motion.button
            className="btn-accent btn-pill"
            style={{ width: '100%', justifyContent: 'center', marginTop: '24px', padding: '10px 16px', fontSize: '14px', fontWeight: 600 }}
            onClick={handleSubmit}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex' }}>
                <Loader2 size={16} />
              </motion.div>
            ) : (
              <Activity size={16} />
            )}
            {loading ? t('analyzing') : t('analyzeCoagulation')}
          </motion.button>

          {isServiceDown && !markdown && (
            <ErrorBanner
              message="The AI service is unreachable. Your Gemini API key may be missing or invalid."
              actionLabel="Go to Settings"
              onAction={() => navigate('/settings')}
              onDismiss={() => setIsServiceDown(false)}
            />
          )}
          {error && !isServiceDown && (
            <div className="error-card">
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          )}
        </div>
      )}

      <div className={`cbc-divider ${isMobile ? 'mobile-hidden' : ''}`} />

      {/* Right Output Panel */}
      <AnimatePresence>
        {(!isMobile || showOutputMobile) && (
          <motion.div 
            className="cbc-output-panel" 
            style={isMobile ? {
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              width: '100%'
            } : { padding: 0 }}
            initial={isMobile ? { opacity: 0, x: 20 } : false}
            animate={isMobile ? { opacity: 1, x: 0 } : false}
            exit={isMobile ? { opacity: 0, x: -20 } : false}
            transition={{ duration: 0.2 }}
          >
            {isMobile && (
              <div style={{ padding: '0 0 16px 0', borderBottom: 'var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                   <span style={{ fontSize: '14px', fontWeight: 700 }}>{displayId || 'Report'}</span>
                   <span style={{ fontSize: '10px', fontWeight: 700, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>COAG</span>
                 </div>
                 <button className="btn-pill" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setShowOutputMobile(false)}>
                   <ArrowLeft size={14} /> Edit Inputs
                 </button>
              </div>
            )}
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
              {loading && !markdown ? (
                <div className="glass-card" style={{ padding: '24px', flex: 1, border: isMobile ? 'none' : undefined, background: isMobile ? 'transparent' : undefined }}>
                  <motion.div 
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ marginTop: 'var(--space-6)', padding: '0 var(--space-3)' }}
                  >
                     <div className="skeleton-pulse" style={{ width: '40%', height: '28px', marginBottom: 'var(--space-6)' }} />
                     <div className="skeleton-pulse" style={{ width: '100%', height: '16px' }} />
                     <div className="skeleton-pulse" style={{ width: '100%', height: '16px' }} />
                     <div className="skeleton-pulse" style={{ width: '90%', height: '16px' }} />
                     <div className="skeleton-pulse" style={{ width: '60%', height: '16px', marginBottom: 'var(--space-6)' }} />
                     <div className="skeleton-pulse" style={{ width: '100%', height: '80px' }} />
                  </motion.div>
                </div>
              ) : (markdown || loading) ? (
                <div style={{ padding: 0, height: '100%' }}>
                  <ReportOutput 
                    markdown={markdown}
                    displayId={displayId}
                    patientName={patientName}
                    moduleType="coag"
                    reportId={reportId}
                    onSaveToCasebook={handleSaveToCasebook}
                  />
                </div>
              ) : (
                <div className={isMobile ? "" : "glass-card"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', flex: 1, padding: '24px' }}>
                  {t('coagPlaceholderText')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
