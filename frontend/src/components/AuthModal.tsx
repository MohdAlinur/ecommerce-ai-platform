import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import api from '../api';
import type { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', 
          callback: async (response: any) => {
            setLoading(true);
            try {
              const res = await api.post('/auth/google/', { token: response.credential });
              onSuccess(res.data);
              resetForm(); onClose();
            } catch (err: any) { setError(err.response?.data?.error || 'Google Authentication failed.'); } finally { setLoading(false); }
          }
        });
        (window as any).google.accounts.id.renderButton(
          document.getElementById('googleSignInDivModal'),
          { theme: 'outline', size: 'large', width: '100%', shape: 'pill' }
        );
      }
    };
  }, [isOpen, isLogin]);

  if (!isOpen) return null;

  const resetForm = () => { setPhone(''); setName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isLogin && password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const res = isLogin ? await api.post('/auth/login/', { phone, password }) : await api.post('/auth/signup/', { name, phone, email, password });
      onSuccess(res.data);
      resetForm(); onClose();
    } catch (err: any) { setError(err.response?.data?.error || 'Authentication failed. Please check inputs.'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl max-w-[400px] w-full p-8 shadow-2xl relative border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
        <button onClick={() => { resetForm(); onClose(); }} className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>

        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black mx-auto mb-4 shadow-md">AT</div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">{isLogin ? 'Sign in to continue' : 'Join AuraTech today'}</p>
        </div>

        {error && <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
            <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-900 transition">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Confirm Password</label>
              <input type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition" />
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-full transition shadow-md disabled:opacity-50 mt-4">
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register')}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center w-full">
          <span className="h-px bg-slate-100 flex-1"></span>
          <span className="px-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Or</span>
          <span className="h-px bg-slate-100 flex-1"></span>
        </div>

        <div id="googleSignInDivModal" className="mt-6 flex justify-center w-full"></div>

        <div className="mt-8 text-center text-sm font-bold text-slate-500">
          {isLogin ? "New to AuraTech?" : "Already have an account?"}{' '}
          <button onClick={() => { setIsLogin(!isLogin); resetForm(); }} className="text-slate-900 hover:underline">
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};