import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const PERKS = [
  { label: 'Verified B2B Pricing',   sub: 'Exclusive wholesale rates on every SKU' },
  { label: 'Bulk Order Management',  sub: 'Matrix ordering across sizes and colours' },
  { label: 'Real-time Catalogue',    sub: 'Live inventory with instant cart sync'   },
  { label: 'Priority Fulfilment',    sub: 'Dedicated dispatch for partner accounts'  },
];

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const login    = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const from     = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex">

      {/* ── Left panel – brand messaging ─────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 overflow-hidden">
        {/* Layered background */}
        <div className="absolute inset-0 bg-secondary" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.6) 39px,rgba(255,255,255,.6) 40px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,.6) 39px,rgba(255,255,255,.6) 40px)',
          }}
        />
        {/* Accent glow blob */}
        <div
          className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'var(--color-accent)' }}
        />
        <div
          className="absolute -bottom-24 right-0 w-96 h-96 rounded-full opacity-[0.07] blur-3xl pointer-events-none"
          style={{ background: 'var(--color-accent)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <span className="text-white text-2xl font-black tracking-tight">
            PRONOUN<span className="text-accent">.</span>
          </span>
        </div>

        {/* Headline */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <p className="text-accent text-xs font-bold uppercase tracking-[0.25em]">
              Wholesale Partner Portal
            </p>
            <h1 className="text-white text-5xl font-black leading-[1.1] tracking-tight">
              The platform<br />
              built for<br />
              <span className="text-accent">serious buyers.</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed max-w-sm">
              Access exclusive B2B pricing, manage bulk orders, and grow your business with real-time catalogue sync.
            </p>
          </div>

          {/* Perks list */}
          <ul className="space-y-4">
            {PERKS.map((perk) => (
              <li key={perk.label} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-sm font-semibold">{perk.label}</p>
                  <p className="text-gray-500 text-xs">{perk.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="relative z-10 text-gray-600 text-xs">
          © {new Date().getFullYear()} Pronoun. Authorised partners only.
        </p>
      </div>

      {/* ── Right panel – login form ──────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 self-start">
          <span className="text-white text-2xl font-black tracking-tight">
            PRONOUN<span className="text-accent">.</span>
          </span>
        </div>

        <div className="w-full max-w-md space-y-8">
          {/* Heading */}
          <div className="space-y-1.5">
            <h2 className="text-white text-3xl font-bold tracking-tight">Partner sign-in</h2>
            <p className="text-gray-500 text-sm">Enter your credentials to access the portal.</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-medium px-4 py-3 rounded-xl"
              style={{ animation: 'fadeIn 0.2s ease' }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-gray-400 text-xs font-bold uppercase tracking-widest block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="partner@company.com"
                  className="w-full bg-secondary border border-white/8 hover:border-white/15 focus:border-accent text-white placeholder-gray-600 rounded-xl pl-11 pr-4 py-3.5 text-sm transition-colors focus:outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-gray-400 text-xs font-bold uppercase tracking-widest block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-secondary border border-white/8 hover:border-white/15 focus:border-accent text-white placeholder-gray-600 rounded-xl pl-11 pr-4 py-3.5 text-sm transition-colors focus:outline-none"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 bg-accent hover:bg-accent/85 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-3.5 rounded-xl transition-all text-sm mt-2"
            >
              {loading ? (
                <><Loader2 className="animate-spin w-4 h-4" /> Signing in…</>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-gray-600 text-xs text-center leading-relaxed pt-2">
            Access is restricted to approved wholesale partners.<br />
            Contact your account manager to request access.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;