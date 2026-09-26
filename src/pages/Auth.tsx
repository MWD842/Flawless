import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, User, ArrowLeft, AtSign, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Step = 'auth' | 'mfa';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // which top-level form to show
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);

  // multi-step: 'auth' → password form, 'mfa' → TOTP challenge
  const [step, setStep] = useState<Step>('auth');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // form fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  // After a successful password sign-in, check whether the user has enrolled
  // TOTP 2FA.  If so, issue a challenge and switch to the MFA step.
  const checkAndHandleMFA = async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (totpFactor) {
        const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
        if (error) throw error;
        setMfaFactorId(totpFactor.id);
        setMfaChallengeId(challenge.id);
        setStep('mfa');
        return; // wait for user to complete MFA
      }
    }
    toast.success(t('login_success'));
    navigate('/');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t('reset_email_sent'));
        setIsForgot(false);
      } else if (isLogin) {
        // Users can log in with either an email or a username.
        let loginEmail = identifier;
        if (!identifier.includes('@')) {
          const { data, error: lookupError } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('username', identifier.toLowerCase())
            .maybeSingle();
          if (lookupError || !data) throw new Error(t('username_not_found'));
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', data.user_id)
            .single();
          if (!profile?.email) throw new Error(t('username_not_found'));
          loginEmail = profile.email;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        await checkAndHandleMFA();
      } else {
        // Signup flow
        const lowerUsername = username.toLowerCase().trim();
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(lowerUsername)) throw new Error(t('username_invalid'));
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', lowerUsername)
          .maybeSingle();
        if (existing) throw new Error(t('username_taken'));
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName, username: lowerUsername },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success(t('signup_success'));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: totpCode,
      });
      if (error) throw error;
      toast.success(t('login_success'));
      navigate('/');
    } catch (error: any) {
      toast.error(error.message);
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // Supabase will redirect the browser — no further action needed here.
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const inputClass =
    'w-full ps-11 pe-4 py-3 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  // ── MFA challenge screen ──────────────────────────────────────────────────
  if (step === 'mfa') {
    return (
      <div className="min-h-screen bg-background scan-grid flex items-center justify-center p-4">
        <motion.div
          key="mfa"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="w-10 h-10 text-primary" />
              <span className="text-3xl font-bold neon-text">{t('brand')}</span>
            </div>
            <p className="text-muted-foreground">{t('mfa_subtitle')}</p>
          </div>

          <div className="glass neon-glow p-8">
            <form onSubmit={handleMFAVerify} className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <KeyRound className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground text-center">{t('mfa_instructions')}</p>
                <InputOTP
                  maxLength={6}
                  value={totpCode}
                  onChange={setTotpCode}
                  autoFocus
                >
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
              <Button
                type="submit"
                disabled={loading || totpCode.length < 6}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow font-semibold py-3"
              >
                {loading ? '...' : t('mfa_verify_btn')}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => { setStep('auth'); setTotpCode(''); }}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('back_to_login')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main auth screen ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background scan-grid flex items-center justify-center p-4">
      <motion.div
        key="auth"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-10 h-10 text-primary" />
            <span className="text-3xl font-bold neon-text">{t('brand')}</span>
          </div>
          <p className="text-muted-foreground">
            {isForgot ? t('reset_subtitle') : isLogin ? t('login_subtitle') : t('signup_subtitle')}
          </p>
        </div>

        <div className="glass neon-glow p-8">
          <form onSubmit={handleAuth} className="space-y-4">
            {/* Signup-only fields */}
            {!isLogin && !isForgot && (
              <>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('display_name')}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="relative">
                  <AtSign className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder={t('username_label')}
                    required
                    minLength={3}
                    maxLength={20}
                    className={inputClass}
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('email_label')}
                    required
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {/* Login / Forgot: single identifier field */}
            {(isLogin || isForgot) && (
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={isLogin ? t('identifier_placeholder') : t('email_label')}
                  required
                  className={inputClass}
                />
              </div>
            )}

            {!isForgot && (
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('password_label')}
                  required
                  minLength={6}
                  className={inputClass}
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow font-semibold py-3"
            >
              {loading
                ? '...'
                : isForgot
                ? t('reset_btn')
                : isLogin
                ? t('login_btn')
                : t('signup_btn')}
            </Button>
          </form>

          {/* Google Sign-In (not shown on forgot-password screen) */}
          {!isForgot && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t('or_continue_with')}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full gap-2 border-border hover:bg-secondary/50"
              >
                <GoogleIcon />
                {t('sign_in_with_google')}
              </Button>
            </>
          )}

          <div className="mt-6 space-y-2 text-center text-sm">
            {!isForgot && (
              <button
                onClick={() => setIsForgot(true)}
                className="text-primary hover:underline block w-full"
              >
                {t('forgot_password')}
              </button>
            )}
            <button
              onClick={() => { setIsLogin(!isLogin); setIsForgot(false); }}
              className="text-muted-foreground hover:text-foreground"
            >
              {isLogin ? t('no_account') : t('have_account')}
            </button>
            {isForgot && (
              <button
                onClick={() => setIsForgot(false)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('back_to_login')}
              </button>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t('back_home')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
