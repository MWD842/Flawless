import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ShieldCheck, AlertTriangle, ShieldAlert, Trash2, Globe, FileUp, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ScanRecord {
  id: string;
  scan_type: string;
  target: string;
  verdict: string;
  detected: number;
  total_engines: number;
  file_hash: string | null;
  created_at: string;
}

const verdictConfig = {
  safe: { icon: ShieldCheck, color: 'text-neon-green', bg: 'bg-neon-green/10', label: 'Safe' },
  suspicious: { icon: AlertTriangle, color: 'text-neon-orange', bg: 'bg-neon-orange/10', label: 'Suspicious' },
  malicious: { icon: ShieldAlert, color: 'text-neon-red', bg: 'bg-neon-red/10', label: 'Malicious' },
};

const typeIcons = { url: Globe, file: FileUp, email: Mail };

interface ScanHistoryProps {
  refreshKey?: number;
}

const ScanHistory = ({ refreshKey }: ScanHistoryProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = async () => {
    if (!user) { setScans([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error(error);
    } else {
      setScans((data as ScanRecord[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchScans(); }, [user, refreshKey]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('scan_history').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Could not delete scan record.', variant: 'destructive' });
    } else {
      setScans(prev => prev.filter(s => s.id !== id));
    }
  };

  if (!user) {
    return (
      <div className="glass p-8 text-center">
        <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground text-sm">{t('login_for_history', 'Log in to see your scan history')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass p-8 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground text-sm">{t('no_scan_history', 'No scans yet. Run your first scan above!')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{t('scan_history', 'Scan History')}</h3>
        <span className="text-xs text-muted-foreground font-mono">({scans.length})</span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence>
          {scans.map((scan, i) => {
            const config = verdictConfig[scan.verdict as keyof typeof verdictConfig] || verdictConfig.safe;
            const Icon = config.icon;
            const TypeIcon = typeIcons[scan.scan_type as keyof typeof typeIcons] || Globe;
            const date = new Date(scan.created_at);

            return (
              <motion.div
                key={scan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                className="glass p-4 flex items-center gap-3 group"
              >
                <div className={`p-2 rounded-lg ${config.bg}`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm font-mono text-foreground truncate">{scan.target}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {scan.detected}/{scan.total_engines}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(scan.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ScanHistory;
