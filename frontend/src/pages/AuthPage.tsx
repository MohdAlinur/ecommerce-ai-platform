import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Info } from 'lucide-react';
import api from '../api';

export const AuthPage: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize Native Google Auth Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Replace when deploying
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await api.post('/auth/login/', { phone, password });
      } else {
        await api.post('/auth/signup/', { name, phone, email, password });
      }
      onLoginSuccess();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-[480px] w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        
        {isLogin ? (
          /* ==========================================
             LOGIN VIEW (Matches Image 1)
             ========================================== */
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Welcome Back</h2>
              <p className="text-slate-500 font-medium">Sign in to your AuraTech account</p>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3 mb-6">
              <Info className="w-5 h-5 text-indigo-600 shrink-0" />
              <p className="text-sm text-indigo-900 font-medium">Forgot phone number? <a href="#" className="font-bold text-indigo-600 hover:underline">Get help here</a></p>
            </div>

            {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-xl">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Phone number</label>
                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" placeholder="Phone number" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-4 pr-12 py-3.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" placeholder="Enter your password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                  <span className="text-sm font-medium text-slate-600">Remember me</span>
                </label>
                <a href="#" className="text-sm font-bold text-indigo-600 hover:underline">Forgotten password?</a>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition shadow-md disabled:opacity-70 mt-2">
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center space-x-3">
              <span className="h-px bg-slate-200 flex-1"></span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Or</span>
              <span className="h-px bg-slate-200 flex-1"></span>
            </div>

            <div id="googleSignInDiv" className="mt-8 flex justify-center w-full"></div>

            <div className="mt-8 text-center text-sm font-medium text-slate-600">
              Don't have an account?{' '}
              <button onClick={() => { setIsLogin(false); setError(''); }} className="text-indigo-600 font-bold hover:underline">Register now</button>
            </div>
          </div>

        ) : (
          /* ==========================================
             REGISTER VIEW (Matches Image 2)
             ========================================== */
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Create Account</h2>
              <p className="text-slate-500 font-medium">Join AuraTech</p>
            </div>

            {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-xl">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Name <span className="text-rose-500">*</span></label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" placeholder="Enter full name" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Phone number <span className="text-rose-500">*</span></label>
                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" placeholder="Enter phone number" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email address <span className="text-rose-500">*</span></label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" placeholder="Enter email address" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-slate-700">Password <span className="text-rose-500">*</span></label>
                  <span className="text-xs font-semibold text-slate-400">Minimum 8 characters</span>
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-4 pr-12 py-3.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" placeholder="Enter password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Repeat password <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-4 pr-12 py-3.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" placeholder="Confirm password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition">
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition shadow-md mt-4 disabled:opacity-70">
                {loading ? 'Processing...' : 'Register'}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center space-x-3">
              <span className="h-px bg-slate-200 flex-1"></span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Or</span>
              <span className="h-px bg-slate-200 flex-1"></span>
            </div>

            <div id="googleSignInDiv" className="mt-8 flex justify-center w-full"></div>

            <div className="mt-8 text-center text-sm font-medium text-slate-600">
              Already registered?{' '}
              <button onClick={() => { setIsLogin(true); setError(''); }} className="text-indigo-600 font-bold hover:underline">Sign in</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};