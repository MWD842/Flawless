import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import SecurityShield from '@/components/SecurityShield';
import ScannerHub from '@/components/ScannerHub';
import ScanHistory from '@/components/ScanHistory';

const Guard = () => {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [threatLevel, setThreatLevel] = useState<'safe' | 'suspicious' | 'malicious' | 'idle'>('idle');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background scan-grid">
      <Header />

      <section className="pt-24 pb-6">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center lg:text-start"
            >
              <h1 className="text-3xl md:text-5xl font-bold neon-text mb-4 text-foreground">
                {t('guard_name')}
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0">
                {t('guard_page_subtitle')}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              <SecurityShield isScanning={isScanning} threatLevel={threatLevel} />
            </motion.div>
          </div>
        </div>
      </section>

      <section id="scanner-hub" className="py-8">
        <div className="container mx-auto px-4">
          <ScannerHub
            onScanStart={() => { setIsScanning(true); setThreatLevel('idle'); }}
            onScanComplete={(level) => { setIsScanning(false); setThreatLevel(level); }}
            onScanSaved={() => setHistoryRefreshKey(k => k + 1)}
          />
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <ScanHistory refreshKey={historyRefreshKey} />
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 Flawless Guard • Defensive Threat Intelligence</p>
      </footer>
    </div>
  );
};

export default Guard;
