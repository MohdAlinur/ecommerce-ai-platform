import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { StorePage } from './pages/StorePage';
import { ProductDetail } from './pages/ProductDetail';
import { AdminDashboard } from './pages/AdminDashboard';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { AuthPage } from './pages/AuthPage';
import {
  fetchProfile, logoutUser, fetchCategories, fetchProducts,
  loginUser, signupUser, createOrder, validateDiscountCode, sendSupportChatMessage
} from './api';
import type { UserProfile, Category, Product, OrderData } from './types';
import { CartProvider, useCart } from './context/CartContext';
import { WishlistProvider, useWishlist } from './context/WishlistContext';
import { CompareProvider, useCompare } from './context/CompareContext';
import {
  Search, User, Shield, LogOut, Phone, ChevronDown, X, ShoppingCart,
  CreditCard, Smartphone, Truck, Bot, Send, Sparkles, Bookmark, Scale,
  Eye, EyeOff, Menu, ShoppingBag, CheckCircle, Trash2, Lock, Tag, AlertCircle, MapPin, ExternalLink
} from 'lucide-react';

const slugify = (text: string) =>
  text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

// Zero-dependency Markdown formatter for AI Chat bubbles:
// Supports **bold**, bullets, numbered lists, clickable internal /product/:id/:slug links, and external Daraz/Amazon/Alibaba links!
function renderChatMarkdown(text: string, isUser: boolean = false) {
  const formatInline = (rawLine: string): React.ReactNode[] => {
    const normalized = rawLine.replace(/\*\*(\[[^\]]+\]\([^)]+\))\*\*/g, '$1');
    const tokens = normalized.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);

    return tokens.map((tok, idx) => {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const label = linkMatch[1].replace(/\*\*/g, '').trim();
        const url = linkMatch[2].trim();

        if (url.startsWith('/')) {
          return (
            <a
              key={idx}
              href={url}
              className={`inline-flex items-center gap-1 font-black underline underline-offset-2 transition ${
                isUser ? 'text-white hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-800'
              }`}
            >
              <ShoppingBag className="w-3 h-3 shrink-0 inline" />
              <span>{label}</span>
            </a>
          );
        }

        return (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-white hover:bg-indigo-600 transition shadow-sm"
          >
            <span>{label}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        );
      }

      if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
        return (
          <strong key={idx} className={isUser ? 'font-black text-white' : 'font-black text-slate-900'}>
            {tok.slice(2, -2)}
          </strong>
        );
      }

      return <React.Fragment key={idx}>{tok}</React.Fragment>;
    });
  };

  const lines = (text || '').split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        const bulletMatch = trimmed.match(/^([*-•])\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isUser ? 'bg-indigo-200' : 'bg-indigo-600'}`} />
              <span className="flex-1 leading-relaxed">{formatInline(bulletMatch[2])}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className={`text-xs font-black mt-0.5 shrink-0 ${isUser ? 'text-indigo-200' : 'text-indigo-600'}`}>
                {numMatch[1]}.
              </span>
              <span className="flex-1 leading-relaxed">{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

const getCachedAiReply = (key: string): string | null => {
  try {
    const raw = sessionStorage.getItem('aura_ai_chat_cache_v2');
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[key] || null;
  } catch {
    return null;
  }
};

const setCachedAiReply = (key: string, reply: string) => {
  try {
    const raw = sessionStorage.getItem('aura_ai_chat_cache_v2');
    const map = raw ? JSON.parse(raw) : {};
    map[key] = reply;
    sessionStorage.setItem('aura_ai_chat_cache_v2', JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
};

let scrollLockCount = 0;
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    scrollLockCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      scrollLockCount -= 1;
      if (scrollLockCount <= 0) {
        scrollLockCount = 0;
        document.body.style.overflow = '';
      }
    };
  }, [locked]);
}

function useHoverDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastPointerType = useRef<string>('mouse');

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return {
    open,
    close: () => setOpen(false),
    containerProps: {
      ref,
      onPointerEnter: (e: React.PointerEvent) => {
        lastPointerType.current = e.pointerType;
        if (e.pointerType === 'mouse') setOpen(true);
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') setOpen(false);
      },
    },
    onTriggerClick: (e: React.MouseEvent) => {
      const viaMouse = lastPointerType.current === 'mouse' && e.detail > 0;
      setOpen(prev => (viaMouse ? true : !prev));
    },
  };
}

const getBrandsForCategory = (products: Product[], cat: Category) => {
  const matchedProds = products.filter(p => {
    return String(p.category) === String(cat.id) || String(p.category_name || '').toLowerCase() === String(cat.name || '').toLowerCase();
  });
  return Array.from(new Set(matchedProds.map(p => p.brand).filter((b): b is string => Boolean(b) && String(b).trim() !== '')));
};

function useCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const reloadCatalog = useCallback(() => {
    Promise.all([fetchCategories(), fetchProducts()])
      .then(([cats, prods]) => {
        setCategories(cats);
        setProducts(prods);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    reloadCatalog();
    window.addEventListener('catalog-updated', reloadCatalog);
    return () => window.removeEventListener('catalog-updated', reloadCatalog);
  }, [reloadCatalog]);

  return { categories, products, reloadCatalog };
}

function AuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({
    identifier: '',
    name: '',
    phone: '',
    email: '',
    shipping_address: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useBodyScrollLock(isOpen);

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
              const res = await fetch('http://127.0.0.1:8000/api/auth/google/', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: response.credential })
              });
              if (!res.ok) throw new Error('Google Authentication failed.');
              onSuccess();
            } catch (err: any) {
              setError(err.message || 'Google Authentication failed.');
            } finally {
              setLoading(false);
            }
          }
        });
        const container = document.getElementById('googleSignInDiv');
        if (container) {
          const width = Math.min(400, Math.max(200, Math.floor(container.clientWidth || 320)));
          (window as any).google.accounts.id.renderButton(
            container,
            { theme: 'outline', size: 'large', width, shape: 'pill' }
          );
        }
      }
    };
  }, [isOpen, mode, onSuccess]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (formData.password.length < 8) return setError('Password must be at least 8 characters.');
      if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await loginUser({ identifier: formData.identifier, password: formData.password });
      } else {
        await signupUser({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          shipping_address: formData.shipping_address,
          password: formData.password
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-base sm:text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl sm:rounded-[2rem] shadow-2xl w-full max-w-[430px] p-5 sm:p-8 relative my-4 sm:my-8 border border-slate-100">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition">
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto mb-4 shadow-md">AT</div>
            <h2 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-sm font-medium text-slate-500">
              {mode === 'login' ? 'Sign in with your Email, Phone, or Username' : 'Join AuraTech for seamless shopping'}
            </p>
          </div>

          {error && <div className="mb-5 p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100 text-center">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'login' ? (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email, Phone, or Username</label>
                <input
                  type="text"
                  required
                  className={inputClass}
                  value={formData.identifier}
                  onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                  placeholder="name@company.com or 017XXXXXXXX"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    className={inputClass}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Md. Alinur"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      className={inputClass}
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      required
                      className={inputClass}
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="017XXXXXXXX"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Default Delivery Address (Optional)</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.shipping_address}
                    onChange={e => setFormData({ ...formData, shipping_address: e.target.value })}
                    placeholder="House, Road, Area, Dhaka"
                  />
                </div>
              </>
            )}

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                {mode === 'signup' && <span className="text-[10px] text-slate-400 font-semibold">Min 8 chars</span>}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className={`${inputClass} pr-12`}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className={`${inputClass} pr-12`}
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 transition"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-bold shadow-md transition disabled:opacity-70 mt-2"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center space-x-4">
            <span className="h-px bg-slate-100 flex-1"></span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Or</span>
            <span className="h-px bg-slate-100 flex-1"></span>
          </div>

          <div id="googleSignInDiv" className="mt-6 flex justify-center w-full"></div>

          <div className="mt-6 text-center text-sm font-bold text-slate-500">
            {mode === 'login' ? 'New to AuraTech? ' : 'Already registered? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-slate-900 hover:underline">
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ user, onOpenAuth }: { user: UserProfile | null; onOpenAuth: () => void }) {
  const { cartItems, removeFromCart, updateQuantity, clearCart, isCartOpen, closeCart } = useCart();
  const [step, setStep] = useState<'cart' | 'checkout' | 'payment' | 'success'>('cart');

  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: 'Dhaka',
    postal_code: '',
    country: 'Bangladesh',
    notes: ''
  });

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bkash' | 'nagad' | 'cod'>('card');
  const [cardDetails, setCardDetails] = useState({
    card_holder_name: '',
    card_number: '',
    card_expiry: '',
    card_cvv: ''
  });
  const [mobileDetails, setMobileDetails] = useState({
    payment_phone: '',
    bkash_trx_id: ''
  });

  const [promoInput, setPromoInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number; amount: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderData | null>(null);

  useBodyScrollLock(isCartOpen);

  useEffect(() => {
    if (user) {
      setShippingInfo(prev => ({
        ...prev,
        name: prev.name || user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
        address: prev.address || user.default_shipping_address || user.shipping_address || '',
        city: prev.city || user.city || 'Dhaka',
        postal_code: prev.postal_code || user.postal_code || ''
      }));
      setCardDetails(prev => ({
        ...prev,
        card_holder_name: prev.card_holder_name || user.name || user.username || ''
      }));
    }
  }, [user, isCartOpen]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!isCartOpen) {
      timeoutId = setTimeout(() => {
        setStep('cart');
        setCheckoutError('');
      }, 300);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [isCartOpen]);

  const subtotal = cartItems.reduce(
    (total, item) => total + Number(item.product.cash_discount_price || item.product.price || 0) * item.quantity,
    0
  );
  const discountAmount = appliedDiscount ? Math.round((subtotal * appliedDiscount.percent) / 100) : 0;
  const shippingFee = subtotal >= 5000 || subtotal === 0 ? 0 : 120;
  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  if (!isCartOpen) return null;

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleApplyPromo = async () => {
    setPromoError('');
    if (!promoInput.trim()) return;
    try {
      const res = await validateDiscountCode(promoInput.trim(), subtotal);
      setAppliedDiscount({
        code: res.code,
        percent: res.discount_percent,
        amount: res.discount_amount
      });
      setPromoInput('');
    } catch (err: any) {
      setPromoError(err.response?.data?.error || 'Invalid promo code.');
    }
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    if (!shippingInfo.name.trim() || !shippingInfo.email.trim() || !shippingInfo.phone.trim() || !shippingInfo.address.trim()) {
      setCheckoutError('Please complete all required customer & delivery fields.');
      return;
    }
    setStep('payment');
  };

  const handleCompleteTransaction = async () => {
    setCheckoutError('');

    if (paymentMethod === 'card') {
      const rawDigits = cardDetails.card_number.replace(/\D/g, '');
      if (!cardDetails.card_holder_name.trim()) return setCheckoutError('Please enter the cardholder name.');
      if (rawDigits.length < 13 || rawDigits.length > 19) return setCheckoutError('Please enter a valid 16-digit card number.');
      if (!/^(0[1-9]|1[0-2])\/\d{2,4}$/.test(cardDetails.card_expiry.trim())) return setCheckoutError('Please enter a valid card expiry date (MM/YY).');
      if (!/^\d{3,4}$/.test(cardDetails.card_cvv.trim())) return setCheckoutError('Please enter a valid 3 or 4 digit CVV code.');
    } else if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      if (!mobileDetails.payment_phone.trim()) return setCheckoutError(`Please enter your ${paymentMethod.toUpperCase()} account number.`);
      if (!mobileDetails.bkash_trx_id.trim()) return setCheckoutError('Please enter your Payment Transaction ID (TrxID).');
    }

    setIsProcessing(true);
    try {
      const orderRes = await createOrder({
        items: cartItems.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          selected_variants: item.selectedVariants || {}
        })),
        shipping: shippingInfo,
        payment_method: paymentMethod,
        payment_details: paymentMethod === 'card' ? cardDetails : mobileDetails,
        discount_code: appliedDiscount?.code || '',
        shipping_fee: shippingFee,
        total: grandTotal
      });
      setCompletedOrder(orderRes);
      clearCart();
      setAppliedDiscount(null);
      setStep('success');
      window.dispatchEvent(new CustomEvent('catalog-updated'));
    } catch (err: any) {
      setCheckoutError(err.response?.data?.error || 'Transaction failed. Please verify your details and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const fieldClass = 'w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition';

  return (
    <div className="fixed inset-0 z-[110] flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeCart}></div>
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
              <ShoppingBag className="w-5 h-5" />
              {step === 'cart' && 'Shopping Bag'}
              {step === 'checkout' && 'Customer & Delivery Info'}
              {step === 'payment' && 'Payment & Billing'}
              {step === 'success' && 'Order Invoice'}
            </h2>
            {step !== 'cart' && step !== 'success' && (
              <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-400">
                <span className={step === 'checkout' ? 'text-slate-900' : 'text-emerald-600'}>1. Customer Info</span>
                <span>→</span>
                <span className={step === 'payment' ? 'text-slate-900' : ''}>2. Payment</span>
              </div>
            )}
          </div>
          <button onClick={closeCart} aria-label="Close bag" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {checkoutError && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {checkoutError}
            </div>
          )}

          {step === 'cart' && (
            cartItems.length === 0 ? (
              <div className="text-center py-24 text-slate-400 flex flex-col items-center">
                <ShoppingBag className="w-12 h-12 mb-4 opacity-40" />
                <p className="font-bold text-slate-600">Your shopping bag is empty.</p>
                <p className="text-xs text-slate-400 mt-1">Explore our catalog and add items to your bag.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3.5 bg-white p-3.5 rounded-3xl shadow-sm border border-slate-100">
                      <img
                        src={item.product.image_display_url || item.product.image_url}
                        alt={item.product.name}
                        className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 object-contain rounded-2xl border border-slate-100 bg-slate-50 p-2"
                      />
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 line-clamp-1 tracking-tight">{item.product.name}</h4>
                          {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                              {Object.entries(item.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                            </p>
                          )}
                          <p className="text-slate-900 font-black text-base mt-1">
                            ৳{Number(item.product.cash_discount_price || item.product.price || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center border border-slate-200 rounded-full bg-slate-50 p-0.5">
                            <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:bg-white transition">-</button>
                            <span className="px-3 text-xs font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:bg-white transition">+</button>
                          </div>
                          <button onClick={() => removeFromCart(item.product.id)} className="text-rose-400 hover:text-rose-600 p-2 rounded-full hover:bg-rose-50 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-100 space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Promo / Discount Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="flex-1 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && <p className="text-xs text-rose-500 font-semibold">{promoError}</p>}
                  {appliedDiscount && (
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">
                      <span>Code {appliedDiscount.code} ({appliedDiscount.percent}% OFF) applied!</span>
                      <button onClick={() => setAppliedDiscount(null)} className="text-rose-500 hover:underline">Remove</button>
                    </div>
                  )}
                </div>
              </>
            )
          )}

          {step === 'checkout' && (
            <form id="checkout-shipping-form" onSubmit={handleProceedToPayment} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-slate-900" />
                <h3 className="font-bold text-slate-900 text-sm">Customer & Delivery Information</h3>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  className={fieldClass}
                  value={shippingInfo.name}
                  onChange={e => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                  placeholder="Md. Alinur"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    className={fieldClass}
                    value={shippingInfo.email}
                    onChange={e => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                    placeholder="customer@email.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className={fieldClass}
                    value={shippingInfo.phone}
                    onChange={e => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                    placeholder="017XXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Street / Delivery Address *</label>
                <textarea
                  rows={2}
                  required
                  className={`${fieldClass} resize-none`}
                  value={shippingInfo.address}
                  onChange={e => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                  placeholder="House #, Road #, Sector / Area"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">City *</label>
                  <input
                    type="text"
                    required
                    className={fieldClass}
                    value={shippingInfo.city}
                    onChange={e => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                    placeholder="Dhaka"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Postal Code</label>
                  <input
                    type="text"
                    className={fieldClass}
                    value={shippingInfo.postal_code}
                    onChange={e => setShippingInfo({ ...shippingInfo, postal_code: e.target.value })}
                    placeholder="1200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Delivery Instructions (Optional)</label>
                <input
                  type="text"
                  className={fieldClass}
                  value={shippingInfo.notes}
                  onChange={e => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
                  placeholder="Call before delivery, leave at gate, etc."
                />
              </div>
            </form>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
                  { id: 'bkash', label: 'bKash Payment', icon: Smartphone },
                  { id: 'nagad', label: 'Nagad Payment', icon: Smartphone },
                  { id: 'cod', label: 'Cash on Delivery', icon: Truck }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                      paymentMethod === m.id
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <m.icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'card' && (
                <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-900" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">Card Details</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <Lock className="w-3 h-3 text-emerald-600" /> 256-Bit SSL Encrypted
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cardholder Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="NAME ON CARD"
                      value={cardDetails.card_holder_name}
                      onChange={e => setCardDetails({ ...cardDetails, card_holder_name: e.target.value })}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Card Number *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="4532 •••• •••• ••••"
                      value={cardDetails.card_number}
                      onChange={e => setCardDetails({ ...cardDetails, card_number: formatCardNumber(e.target.value) })}
                      className={`${fieldClass} font-mono tracking-wider`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expiry Date (MM/YY) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        placeholder="08/29"
                        value={cardDetails.card_expiry}
                        onChange={e => setCardDetails({ ...cardDetails, card_expiry: formatExpiry(e.target.value) })}
                        className={`${fieldClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">CVV / CVC *</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        placeholder="•••"
                        value={cardDetails.card_cvv}
                        onChange={e => setCardDetails({ ...cardDetails, card_cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        className={`${fieldClass} font-mono`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
                <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} Merchant Payment
                    </span>
                    <span className="text-xs font-bold text-emerald-600">Merchant: 01700-000000</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Your {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} Account Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="017XXXXXXXX"
                      value={mobileDetails.payment_phone}
                      onChange={e => setMobileDetails({ ...mobileDetails, payment_phone: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Transaction ID (TrxID) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BKA82910XY"
                      value={mobileDetails.bkash_trx_id}
                      onChange={e => setMobileDetails({ ...mobileDetails, bkash_trx_id: e.target.value.toUpperCase() })}
                      className={`${fieldClass} font-mono uppercase`}
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'cod' && (
                <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2 shadow-sm">
                  <h4 className="font-bold text-sm text-slate-900">Cash on Delivery</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Pay in cash directly to our courier partner when your order arrives at <strong className="text-slate-800">{shippingInfo.address}, {shippingInfo.city}</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'success' && completedOrder && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Transaction Complete</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  Order #{completedOrder.id} • {completedOrder.transaction_id}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Customer</span>
                  <span className="font-bold text-slate-900">{completedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Phone</span>
                  <span className="font-bold text-slate-900">{completedOrder.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Delivery Address</span>
                  <span className="font-bold text-slate-900 text-right max-w-[60%]">{completedOrder.shipping_address}, {completedOrder.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Payment Status</span>
                  <span className={`font-black uppercase ${completedOrder.payment_status === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {completedOrder.payment_status} ({completedOrder.masked_card || completedOrder.payment_method.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-900">Amount Total</span>
                  <span className="font-black text-slate-900">৳{Number(completedOrder.total_amount).toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={closeCart}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full shadow-md transition text-sm"
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>

        {step !== 'success' && cartItems.length > 0 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-3 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] z-10 shrink-0">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>৳{subtotal.toLocaleString()}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Promo Discount ({appliedDiscount?.code})</span>
                  <span>-৳{discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Delivery Charge</span>
                <span>{shippingFee === 0 ? 'FREE' : `৳${shippingFee}`}</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 pt-2 border-t border-slate-100">
                <span className="font-bold text-sm">Total Payable</span>
                <span className="font-black text-xl tracking-tight">৳{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {step === 'cart' && (
              <button
                onClick={() => {
                  if (!user) {
                    closeCart();
                    onOpenAuth();
                  } else {
                    setStep('checkout');
                  }
                }}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-sm shadow-md transition"
              >
                {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
              </button>
            )}

            {step === 'checkout' && (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="px-5 py-3.5 border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="checkout-shipping-form"
                  className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-sm shadow-md transition"
                >
                  Continue to Payment
                </button>
              </div>
            )}

            {step === 'payment' && (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="px-5 py-3.5 border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteTransaction}
                  disabled={isProcessing}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm shadow-md disabled:opacity-70 transition"
                >
                  {isProcessing ? 'Verifying Transaction...' : `Authorize & Pay ৳${grandTotal.toLocaleString()}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CompareDrawer() {
  const { compareItems, removeFromCompare, clearCompare, isCompareOpen, closeCompare } = useCompare();

  useBodyScrollLock(isCompareOpen);

  if (!isCompareOpen) return null;

  const handleAICompare = () => {
    if (compareItems.length >= 2) {
      window.dispatchEvent(new CustomEvent('open-ai-compare', { detail: compareItems }));
      closeCompare();
    } else {
      alert('Please select at least 2 products to compare with the AI Agent.');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex justify-end" role="dialog" aria-modal="true" aria-label="Compare products">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeCompare}></div>
      <div className="relative w-full max-w-5xl bg-slate-50 h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <Scale className="w-5 h-5" /> Compare <span className="text-sm font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{compareItems.length}/4</span>
          </h2>
          <button onClick={closeCompare} aria-label="Close compare" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {compareItems.length === 0 ? (
            <div className="text-center mt-24 sm:mt-40 space-y-4 flex flex-col items-center">
              <Scale className="w-16 h-16 text-slate-300 mb-2 opacity-50" />
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">No Products Selected</h3>
              <p className="text-sm font-medium text-slate-500">Choose items from the store to compare side by side.</p>
            </div>
          ) : (
            <div className="flex gap-4 sm:gap-6 min-h-full overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none">
              {compareItems.map((product) => (
                <div key={product.id} className="min-w-[260px] w-[82%] sm:min-w-[280px] sm:w-1/2 md:w-1/3 lg:w-1/4 snap-start bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden shrink-0 hover:shadow-md transition">
                  <button onClick={() => removeFromCompare(product.id)} aria-label={`Remove ${product.name}`} className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full transition z-10">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="p-4 sm:p-6 h-44 sm:h-56 flex items-center justify-center border-b border-slate-50 bg-slate-50/50">
                    <img src={product.image_display_url || product.image_url} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  </div>
                  <div className="p-4 sm:p-6 flex-1 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{product.brand || product.category_name}</span>
                    <h3 className="font-bold text-base text-slate-900 mb-3 line-clamp-2 tracking-tight">{product.name}</h3>
                    <p className="text-slate-900 font-black text-xl sm:text-2xl mb-6 tracking-tight">৳{Number(product.cash_discount_price || product.price || 0).toLocaleString()}</p>

                    <div className="mt-auto space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Key Specs</h4>
                      <ul className="text-sm text-slate-600 space-y-2">
                        {Array.isArray(product.key_features) && product.key_features.slice(0, 4).map((f, i) => (
                          <li key={i} className="line-clamp-2 flex gap-2"><span className="text-slate-300 mt-1 shrink-0">•</span> {typeof f === 'string' ? f : JSON.stringify(f)}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {compareItems.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-slate-100 bg-white flex gap-3 sm:gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] z-10 shrink-0">
            <button onClick={clearCompare} className="shrink-0 px-4 sm:px-6 py-3.5 text-sm border border-slate-200 font-bold text-slate-600 rounded-full hover:bg-slate-50 transition sm:w-1/4">Clear All</button>
            <button
              onClick={handleAICompare}
              disabled={compareItems.length < 2}
              className="flex-1 min-w-0 px-3 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-50 transition"
            >
              <Sparkles className="w-5 h-5 shrink-0" /> Compare with AI Agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'Hi! I am your **AuraTech AI Shopping & Customer Service Assistant**. Ask me to find or compare products, or ask how to create an account and place an order!' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const handleAICompareEvent = async (e: any) => {
      if (sendingRef.current) return;
      const items = e.detail as Product[];
      setIsOpen(true);

      const productNames = items.map((i, idx) => `${idx + 1}. **${i.name}** (Price: ৳${i.cash_discount_price || i.price})`).join(', ');
      const userPrompt = `Compare these ${items.length} products and tell me which one is best for my needs: ${productNames}`;

      const contextPayload = JSON.stringify({
        comparison_data: items.map(i => ({
          id: i.id,
          name: i.name,
          category: i.category_name || 'Tech',
          brand: i.brand,
          price: i.cash_discount_price,
          features: Array.isArray(i.key_features) ? i.key_features.slice(0, 3) : [],
          description: (i.description || '').slice(0, 150)
        }))
      });

      const cacheKey = `compare::${items.map(i => i.id).sort().join('-')}::${userPrompt.toLowerCase()}`;
      const cached = getCachedAiReply(cacheKey);

      setMessages(prev => [...prev, { role: 'user', content: userPrompt }]);

      if (cached) {
        setMessages(prev => [...prev, { role: 'ai', content: cached }]);
        return;
      }

      sendingRef.current = true;
      setIsTyping(true);
      try {
        const recentHistory = messages.slice(-4).map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.content.slice(0, 250) }]
        }));
        const response = await sendSupportChatMessage(recentHistory, userPrompt, contextPayload);
        if (response.reply) {
          setCachedAiReply(cacheKey, response.reply);
        }
        setMessages(prev => [...prev, { role: 'ai', content: response.reply }]);
        setCooldown(3);
      } catch {
        setMessages(prev => [...prev, { role: 'ai', content: 'Connection error while comparing.' }]);
      } finally {
        setIsTyping(false);
        sendingRef.current = false;
      }
    };

    window.addEventListener('open-ai-compare', handleAICompareEvent);
    return () => window.removeEventListener('open-ai-compare', handleAICompareEvent);
  }, [messages]);

  const handleSend = async (messageText: string) => {
    const cleanText = messageText.trim();
    if (!cleanText || isTyping || cooldown > 0 || sendingRef.current) return;

    setMessages(prev => [...prev, { role: 'user', content: cleanText }]);
    setInput('');

    const cacheKey = `chat::${cleanText.toLowerCase()}`;
    const cached = getCachedAiReply(cacheKey);
    if (cached && messages.length <= 2) {
      setMessages(prev => [...prev, { role: 'ai', content: cached }]);
      return;
    }

    sendingRef.current = true;
    setIsTyping(true);

    try {
      const recentHistory = messages.slice(-4).map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: [{ text: m.content.slice(0, 250) }]
      }));
      const response = await sendSupportChatMessage(recentHistory, cleanText);
      if (response.reply) {
        setCachedAiReply(cacheKey, response.reply);
      }
      setMessages(prev => [...prev, { role: 'ai', content: response.reply }]);
      setCooldown(3);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Connection error. Try again later.' }]);
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
    }
  };

  const quickActions = [
    'Help me choose a smartphone',
    'How to purchase a product?',
    'How to create an account?'
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open AI shopping assistant"
        className={`fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-40 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(79,70,229,0.4)] transition-all duration-300 transform hover:scale-105 flex items-center justify-center ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      <div
        className={`fixed z-50 bg-white shadow-2xl flex flex-col border border-slate-200 overflow-hidden transition-all duration-300 transform origin-bottom
        inset-x-0 bottom-0 max-h-[85dvh] h-[85vh] rounded-t-[2.5rem]
        sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[400px] sm:h-[550px] sm:rounded-3xl
        ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full sm:translate-y-4 opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="bg-slate-900 p-4 sm:p-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-white text-lg tracking-tight leading-tight">Aura AI</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Shopping & Customer Care</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} aria-label="Close assistant" className="hover:bg-white/10 p-2 rounded-full transition text-slate-300 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-1 ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-indigo-600 shadow-sm'}`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[78%] p-3.5 text-sm shadow-sm break-words ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-bl-sm'}`}>
                {renderChatMarkdown(m.content, m.role === 'user')}
              </div>
            </div>
          ))}

          {messages.length === 1 && !isTyping && (
            <div className="flex flex-col gap-2 mt-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  disabled={isTyping || cooldown > 0}
                  onClick={() => handleSend(action)}
                  className="text-xs bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-2xl shadow-sm hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50 transition-all text-left font-semibold"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {isTyping && (
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-1 shadow-sm">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-sm flex gap-1.5 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-200" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="p-3 sm:p-4 bg-white border-t border-slate-100 flex items-end gap-2.5 shrink-0">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            rows={Math.min(3, Math.max(1, input.split('\n').length))}
            placeholder={cooldown > 0 ? `Ready in ${cooldown}s...` : 'Ask about products, orders, or help...'}
            className="flex-1 min-w-0 bg-slate-100 border border-transparent px-4 py-3 rounded-2xl text-base sm:text-sm outline-none text-slate-700 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none leading-relaxed"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!input.trim() || isTyping || cooldown > 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white w-11 h-11 rounded-2xl shadow-sm disabled:opacity-50 transition-all flex items-center justify-center shrink-0 mb-0.5"
          >
            {cooldown > 0 ? <span className="text-[11px] font-bold">{cooldown}s</span> : <Send className="w-4 h-4 ml-0.5" />}
          </button>
        </form>
      </div>
    </>
  );
};

function MobileMenu({ isOpen, onClose, categories, products }: { isOpen: boolean; onClose: () => void; categories: Category[]; products: Product[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] md:hidden" role="dialog" aria-modal="true" aria-label="Browse categories">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-[86%] max-w-sm h-full bg-white shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <Link to="/" onClick={onClose} className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md">AT</div>
            <div><h2 className="font-black text-lg text-slate-900 tracking-tight leading-none">AuraTech</h2><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Smart Store</span></div>
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain p-3">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shop By Category</div>
          <ul className="space-y-1">
            {categories.map(cat => {
              const brands = getBrandsForCategory(products, cat);
              const catKey = String(cat.id);
              const expanded = expandedId === catKey;
              return (
                <li key={cat.id}>
                  <div className="flex items-center rounded-xl hover:bg-slate-50 transition">
                    <Link to={`/?category=${cat.slug}`} onClick={onClose} className="flex-1 min-w-0 px-4 py-3 text-sm font-bold text-slate-700 hover:text-slate-900 truncate">
                      {cat.name}
                    </Link>
                    {brands.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : catKey)}
                        className="p-3 text-slate-400 hover:text-slate-900 transition shrink-0"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {expanded && brands.length > 0 && (
                    <ul className="ml-4 pl-2 my-1 border-l border-slate-100 space-y-0.5">
                      {brands.map((brand, idx) => (
                        <li key={idx}>
                          <Link to={`/?search=${encodeURIComponent(brand)}`} onClick={onClose} className="block px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition truncate">
                            {brand}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function CategoryNavBar({ categories, products }: { categories: Category[]; products: Product[] }) {
  const allMenu = useHoverDropdown();

  const topCategories = [...categories].sort((a, b) => {
    const aCount = products.filter(p => String(p.category) === String(a.id) || p.category_name === a.name).length;
    const bCount = products.filter(p => String(p.category) === String(b.id) || p.category_name === b.name).length;
    return bCount - aCount;
  }).slice(0, 8);

  if (categories.length === 0) return null;

  return (
    <nav className="bg-white text-slate-600 border-b border-slate-200/80 sticky top-[64px] z-40 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-11 text-xs font-bold relative z-50">
        <div className="h-full flex items-center relative shrink-0" {...allMenu.containerProps}>
          <button
            type="button"
            onClick={allMenu.onTriggerClick}
            className="flex items-center gap-2 hover:text-slate-900 px-3.5 py-1.5 transition mr-4 border border-slate-200 rounded-full bg-slate-50 hover:bg-slate-100"
          >
            <Menu className="w-3.5 h-3.5" /> <span className="text-[11px] uppercase tracking-wider">Categories</span>
          </button>

          {allMenu.open && (
            <div className="absolute top-[100%] left-0 bg-white border border-slate-200 shadow-2xl rounded-2xl w-64 z-[100] mt-1 overflow-hidden flex flex-col">
              <ul className="max-h-[60vh] overflow-y-auto p-2 space-y-0.5">
                {categories.map(cat => (
                  <li key={cat.id}>
                    <Link
                      to={`/?category=${cat.slug}`}
                      onClick={allMenu.close}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition"
                    >
                      <span>{cat.name}</span>
                      {cat.product_count !== undefined && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{cat.product_count}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center h-full gap-1 lg:gap-2 relative z-50">
          {topCategories.map((cat, idx) => {
            const brands = getBrandsForCategory(products, cat);
            const visibility = idx < 4 ? 'flex' : idx < 6 ? 'hidden lg:flex' : 'hidden xl:flex';
            return (
              <div key={cat.id} className={`group/nav h-full items-center relative ${visibility}`}>
                <Link to={`/?category=${cat.slug}`} className="hover:text-slate-900 hover:bg-slate-50 px-3 py-1.5 rounded-full transition whitespace-nowrap flex items-center gap-1">
                  {cat.name}
                  {brands.length > 0 && <ChevronDown className="w-3 h-3 text-slate-400 group-hover/nav:text-slate-600 transition" />}
                </Link>

                {brands.length > 0 && (
                  <div className="absolute hidden group-hover/nav:flex flex-col top-[100%] left-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-2xl w-52 z-[100] overflow-hidden">
                    <ul className="max-h-[50vh] overflow-y-auto p-2 space-y-0.5">
                      {brands.map((brand, bIdx) => (
                        <li key={bIdx}>
                          <Link to={`/?search=${encodeURIComponent(brand)}`} className="block px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition truncate">
                            {brand}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function NavigationHeader({ user, onLogout, onOpenAuth, onOpenMenu }: { user: UserProfile | null; onLogout: () => void; onOpenAuth: () => void; onOpenMenu: () => void }) {
  const { cartItems, openCart } = useCart();
  const { wishlistItems } = useWishlist();
  const { compareItems, openCompare } = useCompare();

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = wishlistItems.length;

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const userMenu = useHoverDropdown();

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchTerm.trim().length >= 1) {
        try {
          const results = await fetchProducts(undefined, searchTerm.trim());
          setSuggestions(results.slice(0, 5));
        } catch {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsFocused(false);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setIsFocused(false);
      navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const avatarDisplay = user?.avatar_url
    ? (user.avatar_url.startsWith('http') ? user.avatar_url : `http://127.0.0.1:8000${user.avatar_url}`)
    : null;

  return (
    <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-2 sm:gap-x-4 lg:gap-x-8 gap-y-2.5">
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <button onClick={onOpenMenu} aria-label="Open categories menu" className="md:hidden -ml-2 p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition">
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm group-hover:scale-105 transition-transform">AT</div>
            <div className="hidden min-[400px]:block">
              <h1 className="font-black text-xl text-slate-900 tracking-tight leading-none">AuraTech</h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Curated Tech</span>
            </div>
          </Link>
        </div>

        <div ref={searchRef} className="order-last basis-full min-w-0 md:order-none md:basis-auto md:flex-1 md:max-w-xl relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              enterKeyHint="search"
              placeholder="Search products, brands, or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              className="w-full py-2.5 pl-4 pr-11 rounded-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-slate-900 focus:bg-white transition"
            />
            <button type="submit" aria-label="Search" className="absolute right-1.5 p-1.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition">
              <Search className="w-4 h-4" />
            </button>
          </form>

          {isFocused && suggestions.length > 0 && (
            <div className="absolute top-[100%] left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 py-2 max-h-[70vh] overflow-y-auto">
              {suggestions.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    setIsFocused(false);
                    setSearchTerm('');
                    navigate(`/product/${product.id}/${slugify(product.name)}`);
                  }}
                  className="px-4 py-3 hover:bg-slate-50 transition flex items-center gap-3.5 cursor-pointer border-b border-slate-50 last:border-0"
                >
                  <img src={product.image_display_url || product.image_url} alt={product.name} className="w-11 h-11 object-contain rounded-xl border border-slate-100 bg-white p-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{product.name}</h4>
                    <p className="text-[11px] font-medium text-slate-400 truncate">{product.brand || product.category_name}</p>
                  </div>
                  <span className="font-black text-xs text-slate-900 shrink-0">৳{Number(product.cash_discount_price || product.price || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button onClick={openCompare} aria-label="Open compare" className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition">
            <Scale className="w-5 h-5" />
            {compareItems.length > 0 && <span className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">{compareItems.length}</span>}
          </button>

          <button onClick={() => navigate('/dashboard')} aria-label="Open wishlist" className="relative p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full transition">
            <Bookmark className="w-5 h-5" />
            {wishlistCount > 0 && <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">{wishlistCount}</span>}
          </button>

          <button onClick={openCart} aria-label="Open shopping bag" className="relative p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition sm:mr-1">
            <ShoppingCart className="w-5 h-5" />
            {cartItemCount > 0 && <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">{cartItemCount}</span>}
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-200 mx-1"></div>

          {user ? (
            <div {...userMenu.containerProps} className="relative py-1">
              <button
                type="button"
                onClick={userMenu.onTriggerClick}
                className="flex items-center gap-2 text-left cursor-pointer pl-1 pr-2 py-1 rounded-full hover:bg-slate-50 transition"
              >
                <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                  {avatarDisplay ? (
                    <img src={avatarDisplay} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <span className="hidden lg:inline text-xs font-bold text-slate-900 max-w-[8rem] truncate">{user.name || user.username}</span>
              </button>

              <div className={`absolute top-full right-0 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 transition-all flex flex-col py-2 z-50 ${userMenu.open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                <Link to="/dashboard" onClick={userMenu.close} className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition"><User className="w-4 h-4" /> My Account & Orders</Link>
                {user.is_staff && <Link to="/admin" onClick={userMenu.close} className="px-4 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2.5 transition"><Shield className="w-4 h-4" /> Admin Console</Link>}
                <div className="border-t border-slate-100 my-1"></div>
                <button onClick={() => { userMenu.close(); onLogout(); }} className="w-full px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2.5 transition"><LogOut className="w-4 h-4" /> Sign Out</button>
              </div>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold transition shadow-sm">
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-white text-slate-500 py-12 mt-auto border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs">AT</div>
            <span className="font-black text-slate-900 tracking-tight">AuraTech</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Minimalist, AI-powered technology retail. Authentic hardware, transparent pricing, and fast nationwide delivery.
          </p>
        </div>
        <div>
          <h3 className="text-slate-900 font-bold tracking-wider uppercase text-[11px] mb-3">Navigation</h3>
          <ul className="space-y-2 text-xs font-medium">
            <li><Link to="/" className="hover:text-slate-900 transition">Home Highlights</Link></li>
            <li><Link to="/?view=all" className="hover:text-slate-900 transition">Browse Catalog</Link></li>
            <li><Link to="/dashboard" className="hover:text-slate-900 transition">Order Tracking</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-slate-900 font-bold tracking-wider uppercase text-[11px] mb-3">Customer Care</h3>
          <ul className="space-y-2 text-xs font-medium">
            <li>Official Warranty Coverage</li>
            <li>Easy 7-Day Replacement</li>
            <li>PCI-Compliant Checkout</li>
          </ul>
        </div>
        <div>
          <h3 className="text-slate-900 font-bold tracking-wider uppercase text-[11px] mb-3">Concierge Support</h3>
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-center gap-3">
            <Phone className="w-5 h-5 text-slate-900 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hotline (10AM - 8PM)</p>
              <p className="text-sm font-black text-slate-900">16793 / +880 1700-000000</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 pt-6 border-t border-slate-100 text-xs text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
        <p>© 2026 AuraTech. All rights reserved.</p>
        <p>Engineered with AI Product Intelligence</p>
      </div>
    </footer>
  );
}

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { categories, products } = useCatalog();

  const openMenu = useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  const loadProfile = useCallback(() => {
    fetchProfile().then((data) => setUser(data)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <WishlistProvider>
      <CartProvider>
        <CompareProvider>
          <Router>
            <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col font-sans w-full max-w-[100vw] overflow-x-hidden">
              <NavigationHeader
                user={user}
                onLogout={() => { logoutUser().then(() => { setUser(null); window.location.href = '/'; }); }}
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenMenu={openMenu}
              />
              <CategoryNavBar categories={categories} products={products} />

              <MobileMenu isOpen={isMenuOpen} onClose={closeMenu} categories={categories} products={products} />
              <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onSuccess={() => { setIsAuthOpen(false); loadProfile(); }} />
              <CartDrawer user={user} onOpenAuth={() => setIsAuthOpen(true)} />
              <CompareDrawer />
              <AIAssistant />

              <main className="flex-1 w-full flex flex-col">
                <Routes>
                  <Route path="/" element={<StorePage onProductSelect={(p) => window.location.href = `/product/${p.id}/${slugify(p.name)}`} />} />
                  <Route path="/product/:id" element={<ProductDetailPageWrapper />} />
                  <Route path="/product/:id/:slug" element={<ProductDetailPageWrapper />} />
                  <Route path="/dashboard" element={<CustomerDashboard user={user} onProfileUpdate={loadProfile} />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/auth" element={<AuthPage onLoginSuccess={loadProfile} />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </Router>
        </CompareProvider>
      </CartProvider>
    </WishlistProvider>
  );
}

function ProductDetailPageWrapper() {
  const { id } = useParams<{ id: string }>();
  return <ProductDetail productId={id} />;
}

export default App;