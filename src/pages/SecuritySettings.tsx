import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ShieldCheck, ShieldOff, ArrowLeft, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Header from '@/components/Header';

type SetupStep = 'idle' | 'enrolling' | 'verifying';

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

const SecuritySettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrolledFactorId, setEnrolledFactorId] = useState('');
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Load MFA status on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === 'verified');
      if (verified) {
        setMfaEnabled(true);
        setEnrolledFactorId(verified.id);
      }
      setLoading(false);
    })();
  }, [user]);

  // Begin enrollment: ask Supabase for a TOTP factor
  const startEnrollment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnrollData({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setSetupStep('enrolling');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify the code the user typed to finalise enrollment
  const verifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.factorId,
        code: totpCode,
      });
      if (error) throw error;
      setMfaEnabled(true);
      setEnrolledFactorId(enrollData.factorId);
      setSetupStep('idle');
      setEnrollData(null);
      setTotpCode('');
      toast.success(t('two_factor_setup_success'));
    } catch (err: any) {
      toast.error(err.message);
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  // Remove the TOTP factor
  const disableMFA = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
      if (error) throw error;
      setMfaEnabled(false);
      setEnrolledFactorId('');
      toast.success(t('two_factor_disable_success'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelEnrollment = async () => {
    // Clean up the unverified factor so we don't pollute the factor list
    if (enrollData) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    }
    setSetupStep('idle');
    setEnrollData(null);
    setTotpCode('');
  };

  const copySecret = () => {
    if (!enrollData) return;
    navigator.clipboard.writeText(enrollData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || (loading && !enrollData)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background scan-grid">
      <Header />
      <main className="container mx-auto max-w-xl px-4 pt-28 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Page header */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold neon-text">{t('security_settings')}</h1>
            </div>
          </div>

          {/* 2FA card */}
          <div className="glass neon-glow p-6 rounded-xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                {mfaEnabled ? (
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                ) : (
                  <ShieldOff className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">{t('two_factor_auth')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('two_factor_desc')}</p>
                <p className={`text-sm font-medium mt-2 ${mfaEnabled ? 'text-green-500' : 'text-yellow-500'}`}>
                  {mfaEnabled ? t('two_factor_enabled') : t('two_factor_disabled')}
                </p>
              </div>
            </div>

            {/* ── Idle state ─────────────────────────────────────────────── */}
            {setupStep === 'idle' && (
              <div className="flex gap-3 pt-2">
                {!mfaEnabled ? (
                  <Button
                    onClick={startEnrollment}
                    disabled={loading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
                  >
                    <Shield className="w-4 h-4 me-2" />
                    {t('enable_2fa')}
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={loading}>
                        <ShieldOff className="w-4 h-4 me-2" />
                        {t('disable_2fa')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-strong">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('confirm_disable_2fa')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('confirm_disable_2fa_desc')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('back_to_login')}</AlertDialogCancel>
                        <AlertDialogAction onClick={disableMFA} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {t('disable_2fa')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}

            {/* ── Enrollment: show QR code ────────────────────────────────── */}
            {setupStep === 'enrolling' && enrollData && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-medium text-foreground mb-1">{t('setup_2fa_title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('setup_2fa_step1')}</p>
                </div>

                {/* QR code — Supabase returns an SVG string */}
                <div className="flex justify-center">
                  <div
                    className="bg-white rounded-xl p-4 w-48 h-48 flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: enrollData.qrCode }}
                  />
                </div>

                {/* Manual secret */}
                <div className="bg-secondary/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{t('setup_2fa_manual')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-foreground break-all">{enrollData.secret}</code>
                    <button onClick={copySecret} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3">{t('setup_2fa_step2')}</p>
                  <form onSubmit={verifyEnrollment} className="space-y-4">
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode} autoFocus>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={loading || totpCode.length < 6}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
                      >
                        {loading ? '...' : t('verify_and_enable')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelEnrollment}
                        disabled={loading}
                      >
                        {t('back_to_login')}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default SecuritySettings;
