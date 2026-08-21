import React, { useState } from 'react';
import { X, User, Mail, Lock } from 'lucide-react';
import { updateProfile } from '../api';
import type { UserProfile } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdate: (updatedUser: UserProfile) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, user, onUpdate }) => {
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = { first_name: firstName, last_name: lastName, email };
      if (password) payload.password = password;
      const updated = await updateProfile(payload);
      onUpdate(updated);
      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
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

        <h3 className="text-xl font-bold text-slate-900 mb-1">Account Settings</h3>
        <p className="text-sm text-slate-500 mb-6">Manage your profile details and security</p>

        {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl font-medium">{success}</div>}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">New Password (optional)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep current" className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition shadow-sm disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};