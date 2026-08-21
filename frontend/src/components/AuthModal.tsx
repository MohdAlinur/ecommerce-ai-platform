import React, { useState } from 'react';
import { X, Lock, User, Mail } from 'lucide-react';
import { loginUser, signupUser } from '../api';
import type { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user: UserProfile;
      if (isLogin) {
        user = await loginUser({ username, password });
      } else {
        user = await signupUser({ username, password, email });
      }
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 mb-1">{isLogin ? 'Welcome Back' : 'Create Account'}</h3>
        <p className="text-sm text-slate-500 mb-6">{isLogin ? 'Sign in to access your account' : 'Sign up to start shopping'}</p>

        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm" placeholder="johndoe" />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm" placeholder="john@example.com" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition shadow-sm disabled:opacity-50">
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-600 font-semibold hover:underline">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};