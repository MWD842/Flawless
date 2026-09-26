import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShieldCheck, Swords, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import SecurityShield from '@/components/SecurityShield';
import FeaturesGrid from '@/components/FeaturesGrid';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background scan-grid">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-8 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-start"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 neon-text text-foreground">
                {t('hero_title')}
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mb-8 mx-auto lg:mx-0">
                {t('hero_subtitle')}
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow font-semibold shadow-md">
                  <Link to="/guard">{t('explore_guard')}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary font-semibold">
                  <Link to="/vanguard">{t('explore_vanguard')}</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <SecurityShield isScanning={false} threatLevel="idle" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Two product cards */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10 neon-text">{t('two_products_title')}</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="glass p-8 neon-glow group"
            >
              <ShieldCheck className="w-12 h-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold mb-2 text-foreground">{t('guard_name')}</h3>
              <p className="text-muted-foreground mb-6">{t('guard_tagline')}</p>
              <ul className="text-sm text-muted-foreground space-y-1.5 mb-6 list-disc list-inside">
                <li>{t('guard_point_1')}</li>
                <li>{t('guard_point_2')}</li>
                <li>{t('guard_point_3')}</li>
              </ul>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/guard">{t('open')} {t('guard_name')} <ArrowRight className="w-4 h-4 rtl:rotate-180" /></Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -6 }}
              className="glass p-8 neon-glow-purple group"
            >
              <Swords className="w-12 h-12 text-accent mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold mb-2 text-foreground">{t('vanguard_name')}</h3>
              <p className="text-muted-foreground mb-6">{t('vanguard_tagline')}</p>
              <ul className="text-sm text-muted-foreground space-y-1.5 mb-6 list-disc list-inside">
                <li>{t('vanguard_point_1')}</li>
                <li>{t('vanguard_point_2')}</li>
                <li>{t('vanguard_point_3')}</li>
              </ul>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/vanguard">{t('open')} {t('vanguard_name')} <ArrowRight className="w-4 h-4 rtl:rotate-180" /></Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      <FeaturesGrid />

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 Flawless • Cybersecurity Analysis Platform</p>
      </footer>
    </div>
  );
};

export default Index;
