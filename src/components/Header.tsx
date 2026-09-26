import { useTranslation } from 'react-i18next';
import { useNavigate, NavLink } from 'react-router-dom';
import { Shield, Globe, LogIn, LogOut, User, Sun, Moon, ShieldCheck } from 'lucide-react';
import { isRTL } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'text-sm font-medium transition-colors hover:text-foreground',
    isActive ? 'text-primary' : 'text-muted-foreground'
  );

const Header = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const changeLang = (code: string) => {
    i18n.changeLanguage(code);
    document.documentElement.dir = isRTL(code) ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass-strong">
      <div className="container mx-auto flex items-center justify-between h-16 px-4 gap-4">
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <Shield className="w-7 h-7 text-primary" />
          <span className="text-xl font-bold tracking-tight neon-text">{t('brand')}</span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" end className={navLinkClass}>{t('nav_home')}</NavLink>
          <NavLink to="/guard" className={navLinkClass}>{t('guard_name')}</NavLink>
          <NavLink to="/vanguard" className={navLinkClass}>{t('vanguard_name')}</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <User className="w-4 h-4" />
                  <span className="hidden lg:inline truncate max-w-[120px]">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong w-48">
                <DropdownMenuItem onClick={() => navigate('/settings/security')} className="cursor-pointer gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {t('security_settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/auth')}
              className="gap-1.5 text-primary hover:text-primary/80"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">{t('login')}</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <Globe className="w-4 h-4" />
                <span className="text-xs uppercase">{i18n.language}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong">
              {LANGUAGES.map(l => (
                <DropdownMenuItem key={l.code} onClick={() => changeLang(l.code)} className="cursor-pointer">
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center justify-center gap-5 pb-2 border-t border-border/40 pt-2">
        <NavLink to="/" end className={navLinkClass}>{t('nav_home')}</NavLink>
        <NavLink to="/guard" className={navLinkClass}>{t('guard_name')}</NavLink>
        <NavLink to="/vanguard" className={navLinkClass}>{t('vanguard_name')}</NavLink>
      </nav>
    </header>
  );
};

export default Header;
