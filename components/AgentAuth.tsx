
import React, { useState } from 'react';
import { registerAgent, loginAgent, AuthAgent } from '../services/authService';

interface AgentAuthProps {
    onAuthSuccess: (agent: AuthAgent) => void;
}

export const AgentAuth: React.FC<AgentAuthProps> = ({ onAuthSuccess }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [county, setCounty] = useState('Miami-Dade');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await loginAgent(email, password);
            if (result.success) {
                onAuthSuccess(result.agent);
            } else {
                setError(result.error || 'Invalid email or password.');
            }
        } catch {
            setError('Connection failed. Please check your network.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (!licenseNumber.match(/^[A-Z]{2}\d{5,9}$/)) {
            setError('Please enter a valid FL license number (e.g., BK1234567 or SL12345).');
            return;
        }

        setLoading(true);
        try {
            const result = await registerAgent({ email, password, name, licenseNumber, county });
            if (result.success) {
                onAuthSuccess(result.agent);
            } else {
                setError(result.error || 'Registration failed. Please try again.');
            }
        } catch {
            setError('Connection failed. Please check your network.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="w-full max-w-xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-6">
                        <span>🔐</span> Agent Intelligence Portal
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-3">
                        {mode === 'login' ? 'Welcome Back' : 'Join Closr Intelligence'}
                    </h1>
                    <p className="text-lg text-slate-400">
                        {mode === 'login'
                            ? 'Sign in to access your ethical lead intelligence dashboard.'
                            : 'Create your account with your FL real estate license.'}
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10">
                    {/* Tab Switcher */}
                    <div className="flex mb-8 bg-slate-50 rounded-2xl p-1.5">
                        <button
                            onClick={() => { setMode('login'); setError(''); }}
                            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setMode('register'); setError(''); }}
                            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Create Account
                        </button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-3">
                            <span className="text-lg">⚠️</span> {error}
                        </div>
                    )}

                    {/* Login Form */}
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="agent@realestate.com"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-3">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Signing In...
                                    </span>
                                ) : 'Sign In'}
                            </button>
                        </form>
                    )}

                    {/* Register Form */}
                    {mode === 'register' && (
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Jane Smith"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="agent@realestate.com"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">FL License #</label>
                                    <input
                                        type="text"
                                        value={licenseNumber}
                                        onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                                        required
                                        placeholder="BK1234567"
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Primary County</label>
                                    <select
                                        value={county}
                                        onChange={(e) => setCounty(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium focus:outline-none focus:border-emerald-400 focus:bg-white transition-all appearance-none"
                                    >
                                        <option value="Miami-Dade">Miami-Dade</option>
                                        <option value="Broward">Broward</option>
                                        <option value="Palm Beach">Palm Beach</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    placeholder="Min. 8 characters"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Re-enter password"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                />
                            </div>

                            {/* License Verification Notice */}
                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-sm flex items-start gap-3">
                                <span className="text-lg mt-0.5">📋</span>
                                <div>
                                    <p className="font-bold mb-1">License Verification</p>
                                    <p className="text-xs leading-relaxed">Your FL license number will be verified against the DBPR registry. Your account status will show "Pending" until verification is complete (typically within 24 hours).</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-3">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Creating Account...
                                    </span>
                                ) : 'Create Agent Account'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer text */}
                <p className="text-center text-xs text-slate-300 mt-8 font-medium">
                    By signing in, you agree to Closr's ethical data practices and the{' '}
                    <span className="underline cursor-pointer hover:text-slate-500">SRES® Code of Ethics</span>.
                </p>
            </div>
        </div>
    );
};
