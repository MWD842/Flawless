import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Zap, Layers, BookOpen, Box } from 'lucide-react';

const FeaturesGrid = () => {
  const { t } = useTranslation();

  const features = [
    { icon: Zap, title: t('feature_realtime'), desc: t('feature_realtime_desc'), glow: 'neon-glow' },
    { icon: Layers, title: t('feature_engines'), desc: t('feature_engines_desc'), glow: 'neon-glow-purple' },
    { icon: BookOpen, title: t('feature_edu'), desc: t('feature_edu_desc'), glow: 'neon-glow' },
    { icon: Box, title: t('feature_viz'), desc: t('feature_viz_desc'), glow: 'neon-glow-purple' },
  ];

  return (
    <section id="features" className="py-20">
      <h2 className="text-3xl font-bold text-center mb-12 neon-text">{t('features_title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto px-4">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5 }}
            className={`glass p-6 ${f.glow} group cursor-default`}
          >
            <f.icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-2 text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default FeaturesGrid;
