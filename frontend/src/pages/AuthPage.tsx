import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../api';

export const AuthPage: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', 
          callback: handleGoogleResponse
        });
        (window as any).google.accounts.id.renderButton(
          document.getElementById('googleSignInDiv'),
          { theme: 'outline', size: 'large', width: '100%', shape: 'pill' }
        );
      }
    };
  }, [isLogin]);

  const handleGoogleResponse = async (response: any) => {
    setLoading(true);
    try {
      await api.post('/auth/google/', { token: response.credential });
      onLoginSuccess();
      navigate('/');
    } catch (err: any) { setError(err.response?.data?.error || 'Google Authentication failed.'); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      if (password.length < 8) return setError("Password must be at least 8 characters long.");
      if (password !== confirmPassword) return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      if (isLogin) await api.post('/auth/login/', { phone, password });
      else await api.post('/auth/signup/', { name, phone, email, password });
      onLoginSuccess();
      navigate('/');
    } catch (err: any) { setError(err.response?.data?.error || 'Authentication failed. Please check your inputs.'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[85vh] bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-[440px] w-full bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10">
        
        {isLogin ? (
          <div className="animate-in fade-in duration-500">
            <div className="text-center mb-10">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto mb-6 shadow-md">AT</div>
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Welcome Back</h2>
              <p className="text-slate-500 font-medium">Sign in to your AuraTech account</p>
            </div>

            {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-2xl">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phone number</label>
                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" placeholder="Phone number" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" placeholder="Enter your password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-900 transition">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 pb-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-slate-900 cursor-pointer" />
                  <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900 transition">Remember me</span>
                </label>
                <a href="#" className="text-sm font-bold text-slate-900 hover:underline">Forgot password?</a>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-full transition shadow-md disabled:opacity-70">
                {loading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center space-x-4">
              <span className="h-px bg-slate-100 flex-1"></span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Or</span>
              <span className="h-px bg-slate-100 flex-1"></span>
            </div>

            <div id="googleSignInDiv" className="mt-8 flex justify-center w-full"></div>

            <div className="mt-10 text-center text-sm font-bold text-slate-500">
              New to AuraTech?{' '}
              <button onClick={() => { setIsLogin(false); setError(''); }} className="text-slate-900 hover:underline ml-1">Create an account</button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto mb-6 shadow-md">AT</div>
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Create Account</h2>
              <p className="text-slate-500 font-medium">Join the next-gen marketplace</p>
            </div>

            {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-2xl">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name <span className="text-rose-500">*</span></label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" placeholder="Full name" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phone <span className="text-rose-500">*</span></label>
                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" placeholder="Phone number" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email <span className="text-rose-500">*</span></label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" placeholder="Email address" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-900">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Confirm <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-900">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-full transition shadow-md mt-6 disabled:opacity-70">
                {loading ? 'Processing...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center w-full">
              <span className="h-px bg-slate-100 flex-1"></span>
              <span className="px-4 text-xs text-slate-400 font-bold uppercase tracking-widest">Or</span>
              <span className="h-px bg-slate-100 flex-1"></span>
            </div>

            <div id="googleSignInDiv" className="mt-8 flex justify-center w-full"></div>

            <div className="mt-8 text-center text-sm font-bold text-slate-500">
              Already registered?{' '}
              <button onClick={() => { setIsLogin(true); setError(''); }} className="text-slate-900 hover:underline ml-1">Sign in</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};