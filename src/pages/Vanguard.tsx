import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import Header from '@/components/Header';
import VanguardScanner from '@/components/vanguard/VanguardScanner';

const Vanguard = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = 'Flawless Vanguard – Offensive Security Lab';
  }, []);

  return (
    <div className="min-h-screen bg-background scan-grid">
      <Header />

      <section className="pt-24 pb-6">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-3 mb-3">
              <Swords className="w-10 h-10 text-accent" />
              <h1 className="text-3xl md:text-5xl font-bold neon-text text-foreground">
                {t('vanguard_name')}
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('vanguard_page_subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <VanguardScanner />
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 Flawless Vanguard • For educational and authorized testing only</p>
      </footer>
    </div>
  );
};

export default Vanguard;
