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
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('store')}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-md">
            AI
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">AuraStore</h1>
            <span className="text-xs text-indigo-600 font-medium">Smart AI E-Commerce</span>
          </div>
        </div>

        <nav className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => setCurrentView('store')}
            className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
              currentView === 'store' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Store className="w-4 h-4" />
            <span className="hidden sm:inline">Storefront</span>
          </button>

          {/* Only show Admin Tab if logged-in user is staff/admin */}
          {currentUser?.is_staff && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                currentView === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Dashboard</span>
            </button>
          )}

          <button
            onClick={() => setIsAiChatOpen(true)}
            className="flex items-center space-x-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow-sm hover:opacity-95 transition"
          >
            <Bot className="w-4 h-4" />
            <span>AI Assistant</span>
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
          >
            <ShoppingCart className="w-6 h-6" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {totalItems}
              </span>
            )}
          </button>

          {/* User Auth Section */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 pl-2 pr-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition text-sm font-semibold text-slate-700"
              >
                <div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <span className="hidden md:inline">{currentUser.username}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 shadow-xl rounded-xl py-1 z-50">
                  <button
                    onClick={() => { setDropdownOpen(false); onOpenAccount(); }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); logoutUser().then(onLogout); }}
                    className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-medium"
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
              className="flex items-center space-x-1.5 border border-slate-200 hover:border-indigo-600 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              <User className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};