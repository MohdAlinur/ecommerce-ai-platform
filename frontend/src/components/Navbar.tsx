import React, { useState } from 'react';
import { ShoppingCart, Bot, LayoutDashboard, Store, User, LogOut, Settings } from 'lucide-react';
import { useCart } from '../context/CartContext';
import type { UserProfile } from '../types';
import { logoutUser } from '../api';

interface NavbarProps {
  currentView: 'store' | 'admin';
  setCurrentView: (view: 'store' | 'admin') => void;
  setIsCartOpen: (open: boolean) => void;
  setIsAiChatOpen: (open: boolean) => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenAccount: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  setIsCartOpen,
  setIsAiChatOpen,
  currentUser,
  onOpenAuth,
  onOpenAccount,
  onLogout,
}) => {
  const { totalItems } = useCart();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setCurrentView('store')}>
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold shadow-md group-hover:scale-105 transition-transform">
            AT
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">AuraTech</h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Smart Store</span>
          </div>
        </div>

        <nav className="flex items-center space-x-1 sm:space-x-3">
          <button
            onClick={() => setCurrentView('store')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-semibold transition ${
              currentView === 'store' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Store className="w-4 h-4" />
            <span className="hidden sm:inline">Store</span>
          </button>

          {currentUser?.is_staff && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-semibold transition ${
                currentView === 'admin' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          <button
            onClick={() => setIsAiChatOpen(true)}
            className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full text-sm font-bold transition mx-1"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">AI Agent</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"
          >
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                {totalItems}
              </span>
            )}
          </button>

          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 pl-2 pr-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-full transition text-sm font-semibold text-slate-700 bg-white"
              >
                <div className="w-6 h-6 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center text-xs border border-slate-200">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <span className="hidden md:inline">{currentUser.username}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 shadow-xl rounded-2xl py-2 z-50">
                  <button
                    onClick={() => { setDropdownOpen(false); onOpenAccount(); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2 font-medium"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); logoutUser().then(onLogout); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-bold transition ml-2"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};