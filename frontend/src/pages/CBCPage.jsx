import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../hooks/useScrollLock';
import { Droplet, Check, AlertCircle, ArrowLeft, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import ReportOutput from '../components/ReportOutput';
import ErrorBanner from '../components/ErrorBanner';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useLanguage } from '../context/LanguageContext';
import './CBCPage.css';

export default function CBCPage() {
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

  const [hb, setHb] = useState("");
  const [hct, setHct] = useState("");
  const [rbc, setRbc] = useState("");
  const [mcv, setMcv] = useState("");
  const [mch, setMch] = useState("");
  const [mchc, setMchc] = useState("");
  const [rdw, setRdw] = useState("");

  const [wbc, setWbc] = useState("");
  const [neutrophils, setNeutrophils] = useState("");
  const [lymphocytes, setLymphocytes] = useState("");
  const [monocytes, setMonocytes] = useState("");
  const [eosinophils, setEosinophils] = useState("");
  const [basophils, setBasophils] = useState("");

  const [platelets, setPlatelets] = useState("");
  const [mpv, setMpv] = useState("");

  const [blasts, setBlasts] = useState(false);
  const [schistocytes, setSchistocytes] = useState(false);
  const [hypersegmentedNeutrophils, setHypersegmentedNeutrophils] = useState(false);
  const [rouleaux, setRouleaux] = useState(false);
  const [targetCells, setTargetCells] = useState(false);
  const [otherFlags, setOtherFlags] = useState("");

  const parseNumber = (value) => {
    return value === "" ? null : parseFloat(value);
  };

  const handleSubmit = async () => {
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
      hb: parseNumber(hb),
      hct: parseNumber(hct),
      rbc: parseNumber(rbc),
      mcv: parseNumber(mcv),
      mch: parseNumber(mch),
      mchc: parseNumber(mchc),
      rdw: parseNumber(rdw),
      wbc: parseNumber(wbc),
      neutrophils: parseNumber(neutrophils),
      lymphocytes: parseNumber(lymphocytes),
      monocytes: parseNumber(monocytes),
      eosinophils: parseNumber(eosinophils),
      basophils: parseNumber(basophils),
      platelets: parseNumber(platelets),
      mpv: parseNumber(mpv),
      blasts,
      schistocytes,
      hypersegmented_neutrophils: hypersegmentedNeutrophils,
      rouleaux,
      target_cells: targetCells,
      other_flags: otherFlags === "" ? null : otherFlags,
      patient_age: parseNumber(patientAge),
      patient_sex: patientSex === "" ? null : patientSex
    };

    try {
      const response = await apiClient.post('/analyze/cbc', payload);
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
        setError(err.response?.data?.detail || err.message || "An error occurred during CBC analysis.");
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

  const headerTitle = `${displayId || "Report"} — CBC Analysis${patientName ? ` (${patientName})` : ''}`;

  const FlagToggle = ({ id, label, checked, onChange }) => (
    <div 
      className={`flag-pill ${checked ? 'active' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: checked ? 'var(--accent)' : 'var(--bg-void)', border: checked ? 'none' : '1px solid var(--border-subtle)' }}>
        {checked && <Check size={12} color="#fff" strokeWidth={3} />}
      </div>
      {label}
    </div>
  );

  return (
    <div className="cbc-page">
      {/* Left Form Panel */}
      {(!isMobile || !showOutputMobile) && (
        <div className={`cbc-form-panel glass-card`}>
          <h1 className="text-page-title" style={{ margin: '0 0 var(--space-6) 0' }}>{t('cbcAnalyzer')}</h1>
          
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

          <h3 className="group-heading">{t('redCellIndices')}</h3>
          <div className="input-grid">
            <div>
              <label className="input-label">{t('hgb')}</label>
              <input type="number" className="input-glass" value={hb} onChange={(e)=>setHb(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('hct')}</label>
              <input type="number" className="input-glass" value={hct} onChange={(e)=>setHct(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('rbc')}</label>
              <input type="number" className="input-glass" value={rbc} onChange={(e)=>setRbc(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('mcv')}</label>
              <input type="number" className="input-glass" value={mcv} onChange={(e)=>setMcv(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('mch')}</label>
              <input type="number" className="input-glass" value={mch} onChange={(e)=>setMch(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('mchc')}</label>
              <input type="number" className="input-glass" value={mchc} onChange={(e)=>setMchc(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('rdw')}</label>
              <input type="number" className="input-glass" value={rdw} onChange={(e)=>setRdw(e.target.value)} />
            </div>
          </div>

          <h3 className="group-heading">{t('whiteCells')}</h3>
          <div className="input-grid">
            <div>
              <label className="input-label">{t('wbc')}</label>
              <input type="number" className="input-glass" value={wbc} onChange={(e)=>setWbc(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('neutrophils')}</label>
              <input type="number" className="input-glass" value={neutrophils} onChange={(e)=>setNeutrophils(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('lymphocytes')}</label>
              <input type="number" className="input-glass" value={lymphocytes} onChange={(e)=>setLymphocytes(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('monocytes')}</label>
              <input type="number" className="input-glass" value={monocytes} onChange={(e)=>setMonocytes(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('eosinophils')}</label>
              <input type="number" className="input-glass" value={eosinophils} onChange={(e)=>setEosinophils(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('basophils')}</label>
              <input type="number" className="input-glass" value={basophils} onChange={(e)=>setBasophils(e.target.value)} />
            </div>
          </div>

          <h3 className="group-heading">{t('plateletsHeader')}</h3>
          <div className="input-grid">
            <div>
              <label className="input-label">{t('plateletsLabel')}</label>
              <input type="number" className="input-glass" value={platelets} onChange={(e)=>setPlatelets(e.target.value)} />
            </div>
            <div>
              <label className="input-label">{t('mpv')}</label>
              <input type="number" className="input-glass" value={mpv} onChange={(e)=>setMpv(e.target.value)} />
            </div>
          </div>

          <h3 className="group-heading">{t('qualitativeFlags')}</h3>
          <div className="flag-grid" style={{ marginBottom: '12px' }}>
            <FlagToggle label={t('blasts')} checked={blasts} onChange={setBlasts} />
            <FlagToggle label={t('schistocytes')} checked={schistocytes} onChange={setSchistocytes} />
            <FlagToggle label={t('hypersegPmns')} checked={hypersegmentedNeutrophils} onChange={setHypersegmentedNeutrophils} />
            <FlagToggle label={t('rouleaux')} checked={rouleaux} onChange={setRouleaux} />
            <FlagToggle label={t('targetCells')} checked={targetCells} onChange={setTargetCells} />
          </div>
          <div>
            <label className="input-label">{t('otherFlags')}</label>
            <input type="text" className="input-glass" placeholder={t('otherFlagsPlaceholder')} value={otherFlags} onChange={(e)=>setOtherFlags(e.target.value)} />
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
              <Droplet size={16} />
            )}
            {loading ? t('analyzing') : t('analyzeCbc')}
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
                   <span style={{ fontSize: '10px', fontWeight: 700, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>CBC</span>
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
                    moduleType="cbc"
                    reportId={reportId}
                    onSaveToCasebook={handleSaveToCasebook}
                  />
                </div>
              ) : (
                <div className={isMobile ? "" : "glass-card"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', flex: 1, padding: '24px' }}>
                  {t('cbcPlaceholderText')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
