import React, { useState, useEffect } from 'react';
import { X, Lock, User, Mail, Phone, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../api';
import type { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form States
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
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
    if (!isOpen) return;
    
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Replace with your key when deploying
          callback: handleGoogleResponse
        });
        (window as any).google.accounts.id.renderButton(
          document.getElementById('googleSignInDiv'),
          { theme: 'outline', size: 'large', width: '100%' }
        );
      }
    };
  }, [isOpen, isLogin]);

  if (!isOpen) return null;

  const resetForm = () => {
    setPhone(''); setName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setError('');
  };

  const handleGoogleResponse = async (response: any) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/google/', { token: response.credential });
      onSuccess(res.data);
      resetForm();
      onClose();
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
      let res;
      if (isLogin) {
        res = await api.post('/auth/login/', { phone, password });
      } else {
        res = await api.post('/auth/signup/', { name, phone, email, password });
      }
      onSuccess(res.data);
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
        <button onClick={() => { resetForm(); onClose(); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full transition">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 mb-1">{isLogin ? 'Welcome Back' : 'Create Account'}</h3>
        <p className="text-sm text-slate-500 mb-6">{isLogin ? 'Sign in to your account' : 'Sign up to start shopping'}</p>

        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="Enter full name" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="Enter email address" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number {isLogin ? '' : <span className="text-rose-500">*</span>}</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="Enter phone number" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-600">Password {isLogin ? '' : <span className="text-rose-500">*</span>}</label>
              {!isLogin && <span className="text-[10px] text-slate-400">Min. 8 characters</span>}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-9 pr-10 py-2 border rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="Enter password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-indigo-600 transition">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm Password <span className="text-rose-500">*</span></label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-9 pr-10 py-2 border rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="Confirm password" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-indigo-600 transition">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {isLogin && (
            <div className="flex items-center justify-between text-xs py-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                <span className="font-medium">Remember me</span>
              </label>
              <a href="#" className="text-indigo-600 font-semibold hover:underline">Forgot password?</a>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 mt-2">
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center space-x-2">
          <span className="h-px bg-slate-200 flex-1"></span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Or continue with</span>
          <span className="h-px bg-slate-200 flex-1"></span>
        </div>

        <div id="googleSignInDiv" className="mt-5 flex justify-center w-full"></div>

        <div className="mt-5 text-center text-xs text-slate-500">
          {isLogin ? "Don't have an account?" : "Already registered?"}{' '}
          <button onClick={() => { setIsLogin(!isLogin); resetForm(); }} className="text-indigo-600 font-semibold hover:underline">
            {isLogin ? 'Register now' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};