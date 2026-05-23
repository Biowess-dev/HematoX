import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Droplet, Activity, BarChart3 } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import './HomePage.css';

const MODULES = [
  {
    titleKey: "cbcInterpreter",
    descKey: "cbcInterpreterDesc",
    path: "/cbc",
    icon: Droplet
  },
  {
    titleKey: "coagInterpreter",
    descKey: "coagInterpreterDesc",
    path: "/coag",
    icon: Activity
  },
  {
    titleKey: "rotemInterpreter",
    descKey: "rotemInterpreterDesc",
    path: "/rotem",
    icon: BarChart3
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [stats, setStats] = useState({ total: 0, thisWeek: 0, bookmarked: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/reports');
        const reports = response.data;

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const thisWeek = reports.filter(r => new Date(r.created_at) >= oneWeekAgo).length;
        const bookmarked = reports.filter(r => r.is_bookmarked).length;

        setStats({
          total: reports.length,
          thisWeek,
          bookmarked
        });
      } catch (error) {
        console.error("Failed to fetch reports for stats:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <motion.div
        className="hero-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="hero-title">
          {t('clinicalAnalysis')}
        </h1>
        <p className="hero-subtitle">
          {t('selectModule')}
        </p>
      </motion.div>

      {/* Module Cards */}
      <motion.div
        className="modules-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <motion.div
              key={module.path}
              className="glass-card module-card"
              variants={itemVariants}
              whileHover={{ y: -4, boxShadow: 'var(--shadow-glow)', transition: { duration: 0.15 } }}
              onClick={() => navigate(module.path)}
            >
              <div className="module-icon-wrapper">
                <Icon size={32} />
              </div>
              <div className="module-info">
                <h3 className="module-title">
                  {t(module.titleKey)}
                </h3>
                <p className="module-desc">
                  {t(module.descKey)}
                </p>
              </div>
              <button
                className="btn-accent btn-pill module-cta"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(module.path);
                }}
              >
                {t('openModule')}
              </button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Stats Bar */}
      <motion.div
        className="stats-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="stat-pill">
          <span className="stat-label">{t('totalReports')}</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">{t('reportsThisWeek')}</span>
          <span className="stat-value">{stats.thisWeek}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">{t('bookmarked')}</span>
          <span className="stat-value">{stats.bookmarked}</span>
        </div>
      </motion.div>
    </div>
  );
}
