import { useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Globe, Mail, Upload, Search, ShieldCheck, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, BookOpen, Shield, CheckCircle, XCircle, MinusCircle, Clock, Hash, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ScannerHubProps {
  onScanStart: () => void;
  onScanComplete: (level: 'safe' | 'suspicious' | 'malicious') => void;
  onScanSaved?: () => void;
}

async function saveScanToHistory(
  userId: string,
  scanType: string,
  target: string,
  verdict: string,
  detected: number,
  totalEngines: number,
  fileHash: string,
  stats: Record<string, number> | null,
) {
  try {
    await supabase.from('scan_history').insert({
      user_id: userId,
      scan_type: scanType,
      target,
      verdict,
      detected,
      total_engines: totalEngines,
      file_hash: fileHash || null,
      stats: stats as any,
    });
  } catch (e) {
    console.error('Failed to save scan history:', e);
  }
}

interface EngineResult {
  name: string;
  status: 'clean' | 'detected' | 'timeout' | 'unrated';
  detection?: string;
}

interface VTStats {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout: number;
}

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function callProxy(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('virustotal-proxy', {
    body,
  });
  if (error) throw new Error(error.message || 'Proxy call failed');
  return data;
}

async function pollAnalysis(analysisId: string, maxAttempts = 15): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await callProxy({ action: 'get-analysis', analysisId });
    const status = data?.data?.attributes?.status;
    if (status === 'completed') return data;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Analysis timed out');
}

function vtStatsToEngineResults(results: Record<string, any> | undefined): EngineResult[] {
  if (!results) return [];
  return Object.entries(results).map(([name, info]: [string, any]) => {
    const category = info.category;
    if (category === 'malicious' || category === 'suspicious') {
      return { name, status: 'detected' as const, detection: info.result || 'Detected' };
    }
    if (category === 'timeout') return { name, status: 'timeout' as const };
    if (category === 'undetected' || category === 'harmless') return { name, status: 'clean' as const };
    return { name, status: 'unrated' as const };
  });
}

function deriveVerdict(stats: VTStats): 'safe' | 'suspicious' | 'malicious' {
  if (stats.malicious >= 5) return 'malicious';
  if (stats.malicious >= 1 || stats.suspicious >= 1) return 'suspicious';
  return 'safe';
}

type ThreatCategory = 'phishing' | 'malware' | 'malicious_site' | 'suspicious' | 'sql_injection' | 'spoofing' | 'cryptojacking';

const THREAT_INTEL_MAP: Record<ThreatCategory, { title: string; description: string; counter: string }> = {
  phishing: {
    title: 'Threat Analysis: Phishing',
    description: 'This target has been flagged for credential theft attempts. Phishing attacks impersonate trusted entities to steal login credentials, financial data, or personal information. Attackers often use lookalike domains, forged login pages, and urgency-based social engineering.',
    counter: '• Enable Multi-Factor Authentication (MFA) on all accounts\n• Configure email filtering with SPF, DKIM, and DMARC validation\n• Inspect URLs before clicking — check for typosquatting and subdomain tricks\n• Verify SSL certificate validity and issuer\n• Check HTTP response headers for suspicious redirects (301/302 chains)\n• Use browser-based anti-phishing extensions',
  },
  malware: {
    title: 'Threat Analysis: Malware',
    description: 'Unauthorized code execution detected. This target contains or distributes malicious software designed to compromise systems — including trojans, ransomware, rootkits, or backdoors. The payload may exploit known CVEs or use obfuscation to evade static analysis.',
    counter: '• Deploy Endpoint Detection & Response (EDR) solutions\n• Keep antivirus signatures and OS patches up to date\n• Use application whitelisting to prevent unauthorized executables\n• Sandbox unknown files before execution\n• Monitor outbound network traffic for C2 (Command & Control) beacons\n• Inspect PE headers and file entropy for packing/obfuscation indicators',
  },
  malicious_site: {
    title: 'Threat Analysis: Malicious Web Resource',
    description: 'Multiple security engines have flagged this as a dangerous web resource. It may host drive-by downloads, exploit kits, or serve as a distribution point for malware. The site may attempt to exploit browser vulnerabilities or inject malicious scripts.',
    counter: '• Deploy a Web Application Firewall (WAF) to filter malicious requests\n• Sanitize all user inputs to prevent XSS and injection attacks\n• Implement Content Security Policy (CSP) headers\n• Check SSL/TLS certificate chain validity\n• Inspect HTTP headers for suspicious X-Frame-Options and CORS misconfigurations\n• Use DNS-based threat intelligence feeds to block known bad domains',
  },
  suspicious: {
    title: 'Threat Analysis: Suspicious Activity',
    description: 'This target exhibits characteristics associated with low-reputation or potentially risky resources. While not definitively malicious, indicators such as recently registered domains, obfuscated code, unusual redirect patterns, or missing security headers suggest elevated risk.',
    counter: '• Verify domain registration date and WHOIS data\n• Check for valid HTTPS and inspect the certificate chain\n• Analyze JavaScript for obfuscation patterns (eval, atob, charCodeAt chains)\n• Inspect network requests for hidden iframes or tracking pixels\n• Use VirusTotal community comments and votes for additional context\n• Monitor for behavioral changes — suspicious sites may activate later',
  },
  sql_injection: {
    title: 'Threat Analysis: SQL Injection',
    description: 'SQL injection vectors detected. Attackers can exploit unsanitized input fields to execute arbitrary SQL commands, potentially extracting, modifying, or destroying database contents. This is one of the OWASP Top 10 most critical web vulnerabilities.',
    counter: '• Use parameterized queries and prepared statements (never concatenate SQL)\n• Implement strict input validation and sanitization on all user inputs\n• Apply the principle of least privilege to database service accounts\n• Deploy a WAF with SQL injection rule sets\n• Use stored procedures to abstract direct table access\n• Regularly audit code with static analysis tools (SAST)',
  },
  spoofing: {
    title: 'Threat Analysis: Email Spoofing',
    description: 'Email header analysis indicates forged sender information. The message appears to originate from a different source than claimed, commonly used in Business Email Compromise (BEC) attacks, phishing campaigns, and impersonation fraud.',
    counter: '• Implement SPF, DKIM, and DMARC records for your domain\n• Inspect Received headers to trace the actual mail relay path\n• Verify Return-Path matches the From address\n• Train users to verify sender identity before acting on requests\n• Use email authentication gateways that flag SPF/DKIM failures\n• Report and quarantine suspicious emails immediately',
  },
  cryptojacking: {
    title: 'Threat Analysis: Cryptojacking',
    description: 'Cryptocurrency mining scripts detected. This resource uses visitor computing power without consent to mine cryptocurrency, causing CPU spikes, battery drain, increased electricity costs, and potential hardware degradation.',
    counter: '• Use browser extensions that block WebAssembly-based mining scripts\n• Monitor CPU/GPU usage for unexplained sustained spikes\n• Inspect page source for known mining libraries (Coinhive, CryptoLoot)\n• Implement Content Security Policy headers to restrict script sources\n• Use network monitoring to detect connections to mining pool endpoints\n• Keep ad-blockers updated with mining script signatures',
  },
};

function deriveThreatCategory(engineResults: EngineResult[], stats: VTStats | null): ThreatCategory {
  // VirusTotal hands us a detection name from each engine (e.g. "Trojan.GenericKD",
  // "Phishing.URL.Generic"). We don't get a clean category back, so we roll our own
  // by tallying keyword hits across every detection string and picking the winner.
  const detectionNames = engineResults
    .filter(e => e.status === 'detected' && e.detection)
    .map(e => e.detection!.toLowerCase());

  const allText = detectionNames.join(' ');

  const scores: Record<ThreatCategory, number> = {
    phishing: 0, malware: 0, malicious_site: 0, suspicious: 0,
    sql_injection: 0, spoofing: 0, cryptojacking: 0,
  };

  const keywords: Record<ThreatCategory, string[]> = {
    phishing: ['phish', 'credential', 'login', 'fake', 'deceptive', 'social engineering'],
    malware: ['malware', 'trojan', 'ransomware', 'backdoor', 'worm', 'virus', 'rootkit', 'exploit', 'payload', 'dropper'],
    sql_injection: ['sql', 'injection', 'sqli', 'xss', 'script'],
    spoofing: ['spoof', 'dkim', 'spf', 'dmarc', 'forged', 'impersonat'],
    cryptojacking: ['miner', 'mining', 'crypto', 'coinhive', 'cryptoloot', 'coin'],
    malicious_site: ['malicious', 'malsite', 'harmful', 'dangerous', 'blacklist'],
    suspicious: ['suspicious', 'heuristic', 'pup', 'unwanted', 'adware', 'riskware'],
  };

  for (const [category, words] of Object.entries(keywords)) {
    for (const word of words) {
      const count = (allText.match(new RegExp(word, 'gi')) || []).length;
      scores[category as ThreatCategory] += count;
    }
  }

  let bestCategory: ThreatCategory = 'malicious_site';
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat as ThreatCategory;
    }
  }

  // Nothing matched any keyword — fall back to the raw VT stats so we still show
  // something sensible instead of a random default.
  if (bestScore === 0) {
    if (!stats) return 'suspicious';
    if (stats.malicious >= 5) return 'malicious_site';
    if (stats.malicious >= 1 || stats.suspicious >= 1) return 'suspicious';
    return 'suspicious';
  }

  return bestCategory;
}

const ScannerHub = ({ onScanStart, onScanComplete, onScanSaved }: ScannerHubProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<'safe' | 'suspicious' | 'malicious' | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState('');
  const [emailHeaders, setEmailHeaders] = useState('');
  const [threatCategory, setThreatCategory] = useState<ThreatCategory>('suspicious');
  const [showReadMore, setShowReadMore] = useState(false);
  const [engineResults, setEngineResults] = useState<EngineResult[]>([]);
  const [fileHash, setFileHash] = useState('');
  const [showAllEngines, setShowAllEngines] = useState(false);
  const [vtStats, setVtStats] = useState<VTStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback(() => {
    setScanProgress(0);
    progressInterval.current = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 5 + 1;
      });
    }, 500);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    setScanProgress(100);
  }, []);

  const handleScanUrl = useCallback(async () => {
    if (!url) return;
    setIsScanning(true);
    setScanResult(null);
    setShowReadMore(false);
    setShowAllEngines(false);
    setEngineResults([]);
    setVtStats(null);
    onScanStart();
    startProgress();

    try {
      // VT's URL scan is two hops: submit first, then poll the analysis id
      // until the engines report back.
      const submitData = await callProxy({ action: 'scan-url', url });
      const analysisId = submitData.analysisId;
      if (!analysisId) throw new Error('No analysis ID returned');

      const result = await pollAnalysis(analysisId);
      stopProgress();

      const attrs = result.data.attributes;
      const stats: VTStats = attrs.stats;
      const engines = vtStatsToEngineResults(attrs.results);
      const verdict = deriveVerdict(stats);

      if (verdict !== 'safe') {
        setThreatCategory(deriveThreatCategory(engines, stats));
      }

      setVtStats(stats);
      setEngineResults(engines);
      setFileHash('');
      setScanResult(verdict);
      onScanComplete(verdict);

      if (user) {
        await saveScanToHistory(user.id, 'url', url, verdict, stats.malicious + stats.suspicious, stats.malicious + stats.suspicious + stats.undetected + stats.harmless + stats.timeout, '', stats as any);
        onScanSaved?.();
      }
    } catch (err: any) {
      stopProgress();
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  }, [url, onScanStart, onScanComplete, startProgress, stopProgress, toast]);

  const handleScanFile = useCallback(async (file: File) => {
    setIsScanning(true);
    setScanResult(null);
    setShowReadMore(false);
    setShowAllEngines(false);
    setEngineResults([]);
    setVtStats(null);
    onScanStart();
    startProgress();

    try {
      const hash = await computeSHA256(file);
      setFileHash(hash);

      const result = await callProxy({ action: 'scan-file', hash });
      stopProgress();

      if (result.error) {
        throw new Error(result.error.message || 'Lookup failed');
      }

      // VT has never seen this hash. Don't treat it as an error — just tell
      // the user and show a neutral "safe" state (we genuinely have no info).
      if (result.meta?.not_found) {
        setEngineResults([]);
        setVtStats({ malicious: 0, suspicious: 0, undetected: 0, harmless: 0, timeout: 0 });
        setScanResult('safe');
        onScanComplete('safe');
        toast({ title: 'File not found', description: result.meta.message || 'This file has never been submitted to VirusTotal. It may be safe or simply unknown.' });
        return;
      }

      const attrs = result.data.attributes;
      const stats: VTStats = attrs.last_analysis_stats;
      const engines = vtStatsToEngineResults(attrs.last_analysis_results);
      const verdict = deriveVerdict(stats);

      if (verdict !== 'safe') {
        setThreatCategory(deriveThreatCategory(engines, stats));
      }

      setVtStats(stats);
      setEngineResults(engines);
      setScanResult(verdict);
      onScanComplete(verdict);

      if (user) {
        await saveScanToHistory(user.id, 'file', file.name, verdict, stats.malicious + stats.suspicious, stats.malicious + stats.suspicious + stats.undetected + stats.harmless + stats.timeout, hash, stats as any);
        onScanSaved?.();
      }
    } catch (err: any) {
      stopProgress();
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  }, [onScanStart, onScanComplete, startProgress, stopProgress, toast]);

  const handleEmailScan = useCallback(async () => {
    // We can't scan raw email text against VT, so we pull the first URL out
    // of the headers (that's usually where the suspicious link lives) and
    // run a normal URL scan on it.
    const urlMatch = emailHeaders.match(/https?:\/\/[^\s<>"]+/);
    if (urlMatch) {
      setUrl(urlMatch[0]);
      setIsScanning(true);
      setScanResult(null);
      setShowReadMore(false);
      setShowAllEngines(false);
      setEngineResults([]);
      setVtStats(null);
      onScanStart();
      startProgress();

      try {
        const submitData = await callProxy({ action: 'scan-url', url: urlMatch[0] });
        const analysisId = submitData.analysisId;
        if (!analysisId) throw new Error('No analysis ID returned');

        const result = await pollAnalysis(analysisId);
        stopProgress();

        const attrs = result.data.attributes;
        const stats: VTStats = attrs.stats;
        const engines = vtStatsToEngineResults(attrs.results);
        const verdict = deriveVerdict(stats);

        if (verdict !== 'safe') {
          setThreatCategory(deriveThreatCategory(engines, stats));
        }

        setVtStats(stats);
        setEngineResults(engines);
        setFileHash('');
        setScanResult(verdict);
        onScanComplete(verdict);

        if (user) {
          await saveScanToHistory(user.id, 'email', urlMatch[0], verdict, stats.malicious + stats.suspicious, stats.malicious + stats.suspicious + stats.undetected + stats.harmless + stats.timeout, '', stats as any);
          onScanSaved?.();
        }
      } catch (err: any) {
        stopProgress();
        toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      } finally {
        setIsScanning(false);
      }
    } else {
      toast({ title: 'No URL found', description: 'Could not extract a URL from the email headers to scan.', variant: 'destructive' });
    }
  }, [emailHeaders, onScanStart, onScanComplete, startProgress, stopProgress, toast]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleScanFile(file);
  }, [handleScanFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleScanFile(file);
  }, [handleScanFile]);

  const stats = useMemo(() => {
    if (vtStats) {
      return {
        detected: vtStats.malicious + vtStats.suspicious,
        clean: vtStats.harmless + vtStats.undetected,
        unrated: 0,
        timeout: vtStats.timeout,
        total: vtStats.malicious + vtStats.suspicious + vtStats.undetected + vtStats.harmless + vtStats.timeout,
      };
    }
    if (!engineResults.length) return null;
    const detected = engineResults.filter(e => e.status === 'detected').length;
    const clean = engineResults.filter(e => e.status === 'clean').length;
    const unrated = engineResults.filter(e => e.status === 'unrated').length;
    const timeout = engineResults.filter(e => e.status === 'timeout').length;
    return { detected, clean, unrated, timeout, total: engineResults.length };
  }, [vtStats, engineResults]);

  const threatDetail = useMemo(() => {
    if (!scanResult || scanResult === 'safe') return null;
    return THREAT_INTEL_MAP[threatCategory];
  }, [scanResult, threatCategory]);

  const resultConfig = {
    safe: { icon: ShieldCheck, color: 'text-neon-green', bg: 'border-neon-green/30', bgFill: 'bg-neon-green/5', label: t('safe') },
    suspicious: { icon: AlertTriangle, color: 'text-neon-orange', bg: 'border-neon-orange/30', bgFill: 'bg-neon-orange/5', label: t('suspicious') },
    malicious: { icon: ShieldAlert, color: 'text-neon-red', bg: 'border-neon-red/30', bgFill: 'bg-neon-red/5', label: t('malicious') },
  };

  const displayedEngines = showAllEngines ? engineResults : engineResults.slice(0, 12);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Tabs defaultValue="file" className="w-full">
        <TabsList className="w-full glass-strong mb-6 p-1 h-auto">
          {[
            { value: 'file', icon: FileUp, label: t('tab_file') },
            { value: 'url', icon: Globe, label: t('tab_url') },
            { value: 'email', icon: Mail, label: t('tab_email') },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 gap-2 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:neon-glow transition-all"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="glass neon-glow p-6">
          <TabsContent value="file" className="mt-0">
            <motion.div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <motion.div
                animate={dragActive ? { y: -10, scale: 1.1 } : { y: 0, scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-primary opacity-60" />
              </motion.div>
              <p className="text-foreground font-medium">{t('file_drop')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('file_browse')}</p>
              <p className="text-xs text-muted-foreground mt-3 font-mono">{t('file_limit')}</p>
            </motion.div>
          </TabsContent>

          <TabsContent value="url" className="mt-0 space-y-4">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('url_placeholder')}
                className="w-full ps-11 pe-4 py-3 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleScanUrl}
              disabled={!url || isScanning}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
            >
              {isScanning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('scanning')}</>
              ) : t('url_scan_btn')}
            </Button>
          </TabsContent>

          <TabsContent value="email" className="mt-0 space-y-4">
            <textarea
              value={emailHeaders}
              onChange={(e) => setEmailHeaders(e.target.value)}
              placeholder={t('email_placeholder')}
              rows={6}
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-xs resize-none"
            />
            <Button
              onClick={handleEmailScan}
              disabled={!emailHeaders || isScanning}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
            >
              {isScanning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('scanning')}</>
              ) : t('email_scan_btn')}
            </Button>
          </TabsContent>
        </div>
      </Tabs>

      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 glass p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-primary font-medium text-sm">{t('scanning_engines')}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  Querying VirusTotal API...
                </p>
              </div>
            </div>
            <Progress value={Math.min(scanProgress, 100)} className="h-2" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanResult && !isScanning && stats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 space-y-4"
          >
            <div className={`glass p-6 border-2 ${resultConfig[scanResult].bg}`}>
              <div className="flex items-center gap-4 mb-4">
                {(() => {
                  const Icon = resultConfig[scanResult].icon;
                  return <Icon className={`w-12 h-12 ${resultConfig[scanResult].color}`} />;
                })()}
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t('detection_ratio')}</p>
                  <p className={`text-3xl font-bold font-mono ${resultConfig[scanResult].color}`}>
                    {stats.detected} / {stats.total}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('engines_flagged', { count: stats.detected })}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-lg ${resultConfig[scanResult].bgFill} border ${resultConfig[scanResult].bg}`}>
                  <p className={`text-lg font-bold ${resultConfig[scanResult].color}`}>
                    {resultConfig[scanResult].label}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 text-xs font-mono flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-neon-green" />
                  <span className="text-muted-foreground">{stats.clean} {t('clean')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-neon-red" />
                  <span className="text-muted-foreground">{stats.detected} {t('detected')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{stats.unrated} {t('unrated')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neon-orange" />
                  <span className="text-muted-foreground">{stats.timeout} {t('timeout')}</span>
                </span>
              </div>
            </div>

            {fileHash && (
              <div className="glass p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SHA-256</span>
                </div>
                <p className="text-xs font-mono text-foreground break-all select-all">{fileHash}</p>
              </div>
            )}

            {engineResults.length > 0 && (
              <div className="glass p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('engine_results')}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {displayedEngines.map((engine, i) => (
                    <motion.div
                      key={engine.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`flex items-center justify-between px-3 py-2 rounded text-xs font-mono ${
                        engine.status === 'detected'
                          ? 'bg-neon-red/10 border border-neon-red/20'
                          : engine.status === 'clean'
                          ? 'bg-neon-green/5'
                          : 'bg-muted/30'
                      }`}
                    >
                      <span className="text-foreground truncate">{engine.name}</span>
                      <span className={`shrink-0 ms-2 ${
                        engine.status === 'detected' ? 'text-neon-red font-semibold' :
                        engine.status === 'clean' ? 'text-neon-green' :
                        engine.status === 'timeout' ? 'text-neon-orange' :
                        'text-muted-foreground'
                      }`}>
                        {engine.status === 'detected' ? engine.detection :
                         engine.status === 'clean' ? t('clean') :
                         engine.status === 'timeout' ? t('timeout') : t('unrated')}
                      </span>
                    </motion.div>
                  ))}
                </div>
                {engineResults.length > 12 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllEngines(!showAllEngines)}
                    className="w-full mt-2 gap-1 text-muted-foreground"
                  >
                    {showAllEngines ? t('show_less') : t('show_all_engines', { count: engineResults.length })}
                    {showAllEngines ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            )}

            {scanResult !== 'safe' && threatDetail && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReadMore(!showReadMore)}
                  className={`w-full gap-2 ${resultConfig[scanResult].color}`}
                >
                  <BookOpen className="w-4 h-4" />
                  {showReadMore ? t('read_less') : t('read_more')}
                  {showReadMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>

                <AnimatePresence>
                  {showReadMore && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="glass-strong p-5 rounded-xl space-y-4 mt-2">
                        <div className="flex items-center gap-2">
                          <Shield className={`w-5 h-5 ${resultConfig[scanResult].color}`} />
                          <h4 className="font-bold text-foreground text-lg">{threatDetail.title}</h4>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {t('details')}
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {threatDetail.description}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg border ${resultConfig[scanResult].bg} ${resultConfig[scanResult].bgFill}`}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            <Shield className="w-3 h-3 inline-block me-1" />
                            {t('how_to_counter')}
                          </p>
                          <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                            {threatDetail.counter}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScannerHub;
