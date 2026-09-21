import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { StorePage } from './pages/StorePage';
import { ProductDetail } from './pages/ProductDetail';
import { AdminDashboard } from './pages/AdminDashboard';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { fetchProfile, logoutUser, fetchCategories, fetchProducts, loginUser, signupUser, createOrder, sendSupportChatMessage } from './api';
import type { UserProfile, Category, Product } from './types';
import { CartProvider, useCart } from './context/CartContext';
import { WishlistProvider, useWishlist } from './context/WishlistContext';
import { CompareProvider, useCompare } from './context/CompareContext';
import { Search, User, Shield, LogOut, Phone, ChevronDown, ChevronRight, X, ShoppingCart, CreditCard, Smartphone, Truck, Bot, Send, Sparkles, Bookmark, Scale, Eye, EyeOff, Menu, ShoppingBag, CheckCircle, Trash2 } from 'lucide-react';

const slugify = (text: string) => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

// ============================================================================
// RESPONSIVE / CROSS-DEVICE HELPERS
// ============================================================================

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
  return Array.from(new Set(matchedProds.map(p => p.brand).filter(b => Boolean(b) && String(b).trim() !== '')));
};

function useCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchCategories(), fetchProducts()]).then(([cats, prods]) => {
      if (isMounted) { setCategories(cats); setProducts(prods); }
    }).catch(console.error);
    return () => { isMounted = false; };
  }, []);

  return { categories, products };
}

function AuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
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
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError(''); 
    
    if (mode === 'signup') {
      if (formData.password.length < 8) return setError("Password must be at least 8 characters.");
      if (formData.password !== formData.confirmPassword) return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await loginUser({ email: formData.email, password: formData.password });
      } else {
        await signupUser({ name: formData.name, phone: formData.phone, email: formData.email, password: formData.password });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your inputs.');
    } finally { 
      setLoading(false); 
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-base sm:text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition";

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain" role="dialog" aria-modal="true" aria-label={mode === 'login' ? 'Sign in' : 'Create account'}>
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl sm:rounded-[2rem] shadow-2xl w-full max-w-[420px] p-5 sm:p-8 relative my-4 sm:my-8 border border-slate-100">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
          
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto mb-4 shadow-md">AT</div>
            <h2 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-sm font-medium text-slate-500">{mode === 'login' ? 'Sign in to continue' : 'Join AuraTech today'}</p>
          </div>

          {error && <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100 text-center">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <input type="text" required className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email address</label>
              <input type="email" required className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="name@company.com" />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Phone number</label>
                <input type="tel" required className={inputClass} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+880..." />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                {mode === 'signup' && <span className="text-[10px] text-slate-400 font-semibold">Min 8 chars</span>}
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required className={`${inputClass} pr-12`} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 transition">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Confirm password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} required className={`${inputClass} pr-12`} value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 transition">
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs py-2">
                <label className="flex items-center gap-2 cursor-pointer group py-1">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-slate-900" />
                  <span className="font-bold text-slate-500 group-hover:text-slate-900 transition">Remember me</span>
                </label>
                <a href="#" className="text-slate-900 font-bold hover:underline py-1">Forgot password?</a>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-bold shadow-md transition disabled:opacity-70 mt-4">
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 flex items-center justify-center space-x-4">
            <span className="h-px bg-slate-100 flex-1"></span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Or</span>
            <span className="h-px bg-slate-100 flex-1"></span>
          </div>

          <div id="googleSignInDiv" className="mt-6 sm:mt-8 flex justify-center w-full"></div>

          <div className="mt-6 sm:mt-8 text-center text-sm font-bold text-slate-500">
            {mode === 'login' ? "New to AuraTech? " : "Already registered? "}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-slate-900 hover:underline">
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ user }: { user: UserProfile | null }) {
  const { cartItems, removeFromCart, updateQuantity, clearCart, isCartOpen, closeCart } = useCart();
  const [step, setStep] = useState<'cart' | 'checkout' | 'payment' | 'success'>('cart');
  const [shippingInfo, setShippingInfo] = useState({ name: user?.username || '', address: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'card' | 'cod'>('bkash');
  const [isProcessing, setIsProcessing] = useState(false);

  useBodyScrollLock(isCartOpen);

  useEffect(() => { 
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!isCartOpen) {
      timeoutId = setTimeout(() => { setStep('cart'); }, 300);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [isCartOpen]);

  const cartTotal = cartItems.reduce((total, item) => total + (Number(item.product.cash_discount_price || item.product.price || 0) * item.quantity), 0);

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      await createOrder({
        items: cartItems.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
        shipping: shippingInfo, 
        payment_method: paymentMethod, 
        total: cartTotal
      });
      clearCart();
      setStep('success');
    } catch (err) {
      alert("Failed to process payment. Backend API error.");
    } finally { 
      setIsProcessing(false); 
    }
  };

  const fieldClass = "w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-base sm:text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition";

  return (
    <div className="fixed inset-0 z-[110] flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeCart}></div>
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <ShoppingBag className="w-5 h-5"/> 
            {step === 'cart' ? 'Your Bag' : step === 'success' ? 'Confirmed' : 'Checkout'}
          </h2>
          <button onClick={closeCart} aria-label="Close bag" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {step === 'cart' && (
            cartItems.length === 0 ? <div className="text-center py-20 text-slate-400 flex flex-col items-center"><ShoppingBag className="w-12 h-12 mb-4 opacity-50"/><p className="font-bold text-slate-500">Your bag is empty.</p></div> :
            cartItems.map((item, idx) => (
              <div key={idx} className="flex gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 transition hover:shadow-md">
                <img src={item.product.image_display_url || item.product.image_url} alt={item.product.name} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 object-contain rounded-2xl border border-slate-100 bg-slate-50 p-2" />
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-1 tracking-tight mb-1">{item.product.name}</h4>
                    <p className="text-slate-900 font-black text-base">৳{Number(item.product.cash_discount_price || item.product.price || 0).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <div className="flex items-center border border-slate-200 rounded-full bg-slate-50 p-0.5">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} aria-label="Decrease quantity" className="w-8 h-8 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:bg-white hover:shadow-sm transition">-</button>
                      <span className="px-3 text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} aria-label="Increase quantity" className="w-8 h-8 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:bg-white hover:shadow-sm transition">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)} aria-label="Remove item" className="text-rose-400 hover:text-rose-600 p-2 rounded-full hover:bg-rose-50 transition"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))
          )}

          {step === 'checkout' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-900 tracking-tight">Shipping Details</h3>
              <input type="text" className={fieldClass} value={shippingInfo.name} onChange={e => setShippingInfo({...shippingInfo, name: e.target.value})} placeholder="Full Name" />
              <input type="text" inputMode="tel" className={fieldClass} value={shippingInfo.phone} onChange={e => setShippingInfo({...shippingInfo, phone: e.target.value})} placeholder="Phone Number" />
              <textarea rows={3} className={`${fieldClass} resize-none`} value={shippingInfo.address} onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})} placeholder="Delivery Address" />
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 px-2 tracking-tight">Select Payment</h3>
              <label className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border cursor-pointer transition ${paymentMethod === 'bkash' ? 'border-[#e2136e] bg-[#e2136e]/5 ring-1 ring-[#e2136e]' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" value="bkash" className="sr-only" checked={paymentMethod === 'bkash'} onChange={() => setPaymentMethod('bkash')} />
                <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-[#e2136e] rounded-2xl flex items-center justify-center text-white shadow-sm"><Smartphone className="w-6 h-6"/></div>
                <div><h4 className="font-bold text-slate-900">bKash Banking</h4></div>
              </label>
              {paymentMethod === 'bkash' && <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#e2136e]/20"><input type="text" inputMode="tel" placeholder="bKash Number" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-base sm:text-sm outline-none focus:border-[#e2136e] transition" /></div>}

              <label className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border cursor-pointer transition ${paymentMethod === 'card' ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" value="card" className="sr-only" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-sm"><CreditCard className="w-6 h-6"/></div>
                <div><h4 className="font-bold text-slate-900">Credit / Debit Card</h4></div>
              </label>

              <label className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border cursor-pointer transition ${paymentMethod === 'cod' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" value="cod" className="sr-only" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-sm"><Truck className="w-6 h-6"/></div>
                <div><h4 className="font-bold text-slate-900">Cash on Delivery</h4></div>
              </label>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center mt-16 sm:mt-32 space-y-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 sm:w-12 sm:h-12"/></div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Confirmed!</h3>
              <p className="text-slate-500 font-medium mb-8">Your order has been placed successfully.</p>
              <button onClick={closeCart} className="px-8 py-3.5 bg-slate-900 text-white font-bold rounded-full shadow-md hover:bg-slate-800 transition w-full">Continue Shopping</button>
            </div>
          )}
        </div>

        {step !== 'success' && cartItems?.length > 0 && (
          <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-white space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] z-10 shrink-0">
            <div className="flex justify-between items-center text-slate-900 mb-2">
              <span className="font-bold text-slate-500">Total</span>
              <span className="font-black text-xl sm:text-2xl tracking-tight">৳{cartTotal.toLocaleString()}</span>
            </div>
            {step === 'cart' && <button onClick={() => { user ? setStep('checkout') : alert('Please log in to checkout.') }} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold shadow-md transition">Checkout</button>}
            {step === 'checkout' && <button onClick={() => setStep('payment')} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold shadow-md transition">Continue to Payment</button>}
            {step === 'payment' && <button onClick={handleCheckout} disabled={isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold shadow-md disabled:opacity-70 transition">{isProcessing ? 'Processing...' : `Pay ৳${cartTotal.toLocaleString()}`}</button>}
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
      alert("Please select at least 2 products to compare with the AI Agent.");
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex justify-end" role="dialog" aria-modal="true" aria-label="Compare products">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeCompare}></div>
      <div className="relative w-full max-w-5xl bg-slate-50 h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <Scale className="w-5 h-5"/> Compare <span className="text-sm font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{compareItems.length}/4</span>
          </h2>
          <button onClick={closeCompare} aria-label="Close compare" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {compareItems.length === 0 ? (
            <div className="text-center mt-24 sm:mt-40 space-y-4 flex flex-col items-center">
              <Scale className="w-16 h-16 text-slate-300 mb-2 opacity-50" />
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">No Products Selected</h3>
              <p className="text-sm font-medium text-slate-500">Choose items from the store to compare.</p>
            </div>
          ) : (
            <div className="flex gap-4 sm:gap-6 min-h-full overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory sm:snap-none">
              {compareItems.map((product) => (
                <div key={product.id} className="min-w-[260px] w-[82%] sm:min-w-[280px] sm:w-1/2 md:w-1/3 lg:w-1/4 snap-start bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden shrink-0 hover:shadow-md transition">
                  <button onClick={() => removeFromCompare(product.id)} aria-label={`Remove ${product.name} from compare`} className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full transition z-10">
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
              
              {compareItems.length < 4 && (
                <div className="min-w-[260px] w-[82%] sm:min-w-[280px] sm:w-1/2 md:w-1/3 lg:w-1/4 snap-start bg-slate-50/50 rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-8 text-center shrink-0 hover:bg-slate-100 transition">
                  <Search className="w-10 h-10 mb-4 opacity-50" />
                  <p className="text-sm font-bold text-slate-500">Add another product<br/>to compare</p>
                </div>
              )}
            </div>
          )}
        </div>

        {compareItems.length > 0 && (
          <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-white flex gap-3 sm:gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] z-10 shrink-0">
            <button onClick={clearCompare} className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 text-sm sm:text-base border border-slate-200 font-bold text-slate-600 rounded-full hover:bg-slate-50 transition sm:w-1/4">Clear All</button>
            <button 
              onClick={handleAICompare} disabled={compareItems.length < 2}
              className="flex-1 min-w-0 px-3 py-3.5 sm:py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm sm:text-base font-bold leading-tight flex items-center justify-center gap-2 shadow-md disabled:opacity-50 transition"
            >
              <Sparkles className="w-5 h-5 shrink-0" /> Compare with AI Agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PERFECTED AI ASSISTANT: Fixed Floating Positioning & Premium Send Button
// ============================================================================
const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', content: string}[]>([{ role: 'ai', content: 'Hi! I am your AuraTech AI. I can find the best products for you, answer technical questions, or compare items. How can I help?' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleAICompareEvent = async (e: any) => {
      const items = e.detail as Product[];
      setIsOpen(true);
      
      const productNames = items.map((i, idx) => `${idx + 1}. ${i.name} (Price: ৳${i.cash_discount_price || i.price})`).join(', ');
      const userPrompt = `Compare these ${items.length} products and tell me which one is best for my needs: ${productNames}`;
      
      const contextPayload = JSON.stringify({
        comparison_data: items.map(i => ({
          name: i.name, brand: i.brand, price: i.cash_discount_price,
          features: i.key_features, specs: i.specifications,
          variants: i.variants, description: i.description
        }))
      });

      setMessages(prev => [...prev, { role: 'user', content: userPrompt }]);
      setIsTyping(true);
      try {
        const history = messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] }));
        const response = await sendSupportChatMessage(history, userPrompt, contextPayload);
        setMessages(prev => [...prev, { role: 'ai', content: response.reply }]);
      } catch {
        setMessages(prev => [...prev, { role: 'ai', content: 'Connection error while comparing.' }]);
      } finally { setIsTyping(false); }
    };

    window.addEventListener('open-ai-compare', handleAICompareEvent);
    return () => window.removeEventListener('open-ai-compare', handleAICompareEvent);
  }, [messages]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: messageText }]);
    setInput(''); setIsTyping(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const response = await sendSupportChatMessage(history, messageText);
      setMessages(prev => [...prev, { role: 'ai', content: response.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Connection error. Try again later.' }]);
    } finally { setIsTyping(false); }
  };

  const quickActions = [
    "Gaming laptop under ৳100,000",
    "Best monitor for office work?",
    "Help me choose a smartphone"
  ];

  return (
    <>
      <button onClick={() => setIsOpen(true)} aria-label="Open AI shopping assistant" className={`fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-40 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(79,70,229,0.4)] transition-all duration-300 transform hover:scale-105 flex items-center justify-center ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
        <Sparkles className="w-6 h-6" />
      </button>

      {/* 
        FIXED AI WIDGET CONTAINER: 
        - Mobile: `inset-x-0 bottom-0 max-w-full rounded-t-[2.5rem]` (Full-width bottom drawer)
        - Desktop (`sm` up): `right-6 bottom-6 w-[400px] h-[550px] rounded-3xl` (Anchored floating box)
      */}
      <div className={`fixed z-50 bg-white shadow-2xl flex flex-col border border-slate-200 overflow-hidden transition-all duration-300 transform origin-bottom
        inset-x-0 bottom-0 max-h-[85dvh] h-[85vh] rounded-t-[2.5rem]
        sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[400px] sm:h-[550px] sm:rounded-3xl
        ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full sm:translate-y-4 opacity-0 scale-95 pointer-events-none'}`}
      >
        
        {/* Header */}
        <div className="bg-slate-900 p-4 sm:p-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-white text-lg tracking-tight leading-tight">Aura AI</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Shopping Assistant</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} aria-label="Close assistant" className="hover:bg-white/10 p-2 rounded-full transition text-slate-300 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 bg-slate-50/50" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {messages.map((m, idx) => (
            <div key={idx} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-1 ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-indigo-600 shadow-sm'}`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[78%] p-3.5 text-sm leading-relaxed shadow-sm break-words [overflow-wrap:anywhere] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-bl-sm whitespace-pre-wrap'}`}>
                {m.content}
              </div>
            </div>
          ))}
          
          {messages.length === 1 && !isTyping && (
            <div className="flex flex-col gap-2 mt-2">
              {quickActions.map((action, idx) => (
                <button key={idx} onClick={() => handleSend(action)} className="text-xs bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-2xl shadow-sm hover:border-indigo-300 hover:text-indigo-700 transition-all text-left font-semibold">
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
        
        {/* Input Area */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex items-end gap-2.5 shrink-0">
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
            placeholder="Message AI Agent..."
            className="flex-1 min-w-0 bg-slate-100 border border-transparent px-4 py-3 rounded-2xl text-base sm:text-sm outline-none text-slate-700 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none leading-relaxed"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          />
          <button type="submit" aria-label="Send message" disabled={!input.trim() || isTyping} className="bg-indigo-600 hover:bg-indigo-700 text-white w-11 h-11 rounded-2xl shadow-sm disabled:opacity-50 transition-all flex items-center justify-center shrink-0 mb-0.5">
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>

      </div>
    </>
  );
};

// ============================================================================
// MOBILE MENU
// ============================================================================
function MobileMenu({ isOpen, onClose, categories, products }: { isOpen: boolean; onClose: () => void; categories: Category[]; products: Product[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onResize = () => { if (window.innerWidth >= 768) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen, onClose]);

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

        <nav className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} ${cat.name} brands`}
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
                      <li>
                        <Link to={`/?category=${cat.slug}`} onClick={onClose} className="block px-4 py-2.5 text-xs font-black text-slate-900 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition">
                          View All
                        </Link>
                      </li>
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

// ============================================================================
// CATEGORY NAV BAR
// ============================================================================
function CategoryNavBar({ categories, products }: { categories: Category[]; products: Product[] }) {
  const allMenu = useHoverDropdown();

  const topCategories = [...categories].sort((a, b) => {
    const aCount = products.filter(p => String(p.category) === String(a.id) || p.category_name === a.name).length;
    const bCount = products.filter(p => String(p.category) === String(b.id) || p.category_name === b.name).length;
    return bCount - aCount;
  }).slice(0, 8); 

  return (
    <nav className="bg-white text-slate-600 border-b border-slate-200 shadow-sm sticky top-[64px] z-40 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-12 text-sm font-bold relative z-50">
        
        <div 
          className="h-full flex items-center relative shrink-0"
          {...allMenu.containerProps}
        >
          <button
            type="button"
            onClick={allMenu.onTriggerClick}
            aria-haspopup="true"
            aria-expanded={allMenu.open}
            className="flex items-center gap-2 hover:text-slate-900 px-4 py-2 transition h-9 mr-4 lg:mr-6 border border-slate-200 rounded-full bg-slate-50 hover:bg-slate-100"
          >
            <Menu className="w-4 h-4"/> <span className="text-xs uppercase tracking-widest">All</span>
          </button>

          {allMenu.open && (
            <div className="absolute top-[100%] left-0 bg-white border border-slate-200 shadow-2xl rounded-2xl w-72 max-w-[calc(100vw-2rem)] z-[100] mt-1 overflow-hidden flex flex-col">
              <div className="px-6 py-4 font-black text-sm text-slate-900 border-b border-slate-100 bg-slate-50 uppercase tracking-widest">
                Shop By Category
              </div>
              <ul className="max-h-[60vh] overflow-y-auto custom-scrollbar p-3 space-y-1">
                {categories.map(cat => (
                  <li key={cat.id}>
                    <Link 
                      to={`/?category=${cat.slug}`} 
                      onClick={allMenu.close}
                      className="block px-4 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition"
                    >
                      {cat.name}
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
             const visibility = idx < 3 ? 'flex' : idx < 6 ? 'hidden lg:flex' : 'hidden xl:flex';
             return (
               <div key={cat.id} className={`group/nav h-full items-center relative ${visibility}`}>
                 <Link to={`/?category=${cat.slug}`} className="hover:text-slate-900 hover:bg-slate-50 px-3 py-1.5 rounded-full transition whitespace-nowrap flex items-center gap-1.5">
                   {cat.name}
                   {brands.length > 0 && <ChevronDown className="w-3 h-3 text-slate-400 group-hover/nav:text-slate-600 transition" />}
                 </Link>
                 
                 {brands.length > 0 && (
                    <div className="absolute hidden group-hover/nav:flex flex-col top-[100%] left-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-2xl w-56 z-[100] overflow-hidden">
                      <ul className="max-h-[60vh] overflow-y-auto custom-scrollbar p-3 space-y-1">
                        {brands.map((brand, idx) => (
                          <li key={idx}>
                            <Link to={`/?search=${encodeURIComponent(brand)}`} className="block px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition line-clamp-1">
                              {brand}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="bg-slate-50 border-t border-slate-100 p-3 mt-auto">
                        <Link to={`/?category=${cat.slug}`} className="block w-full py-3 text-center text-xs font-black text-slate-900 hover:text-white bg-white hover:bg-slate-900 border border-slate-200 rounded-xl transition uppercase tracking-widest shadow-sm">
                          View All
                        </Link>
                      </div>
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
        } catch (err) { setSuggestions([]); }
      } else { setSuggestions([]); }
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

  const avatarDisplay = user?.avatar_url ? `http://127.0.0.1:8000${user.avatar_url}` : null;

  return (
    <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-2 sm:gap-x-4 lg:gap-x-8 gap-y-2.5">
        
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <button onClick={onOpenMenu} aria-label="Open categories menu" className="md:hidden -ml-2 p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition">
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-md group-hover:scale-105 transition-transform">AT</div>
            <div className="hidden min-[400px]:block"><h1 className="font-black text-xl text-slate-900 tracking-tight leading-none">AuraTech</h1><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Smart Store</span></div>
          </Link>
        </div>
        
        <div ref={searchRef} className="order-last basis-full min-w-0 md:order-none md:basis-auto md:flex-1 md:max-w-2xl relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input 
              type="text" 
              enterKeyHint="search"
              placeholder="Search curated tech..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              className="w-full py-2.5 pl-5 pr-12 rounded-full bg-slate-50 border border-slate-200 text-slate-900 text-base md:text-sm font-medium focus:outline-none focus:border-slate-900 focus:bg-white transition shadow-sm"
            />
            <button type="submit" aria-label="Search" className="absolute right-2 p-1.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition">
              <Search className="w-4 h-4" />
            </button>
          </form>

          {isFocused && suggestions.length > 0 && (
            <div className="absolute top-[100%] left-0 right-0 mt-3 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 py-3 max-h-[70vh] overflow-y-auto overscroll-contain">
              <div className="px-4 sm:px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">Top Matches</div>
              {suggestions.map((product) => (
                <div 
                  key={product.id}
                  onClick={() => {
                    setIsFocused(false); setSearchTerm('');
                    navigate(`/product/${product.id}/${slugify(product.name)}`);
                  }}
                  className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50 transition flex items-center gap-3 sm:gap-4 cursor-pointer border-b border-slate-50 last:border-0"
                >
                  <img src={product.image_display_url || product.image_url} alt={product.name} className="w-12 h-12 object-contain rounded-xl border border-slate-100 bg-white p-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 truncate tracking-tight">{product.name}</h4>
                    <p className="text-xs font-medium text-slate-500 truncate">{product.brand || product.category_name}</p>
                  </div>
                  <span className="font-black text-sm text-slate-900 shrink-0">৳{Number(product.cash_discount_price || product.price || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="p-3 bg-slate-50 border-t border-slate-100">
                <div onClick={() => { setIsFocused(false); navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`); }} className="px-4 py-3 bg-white border border-slate-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white rounded-2xl text-center text-xs font-bold text-slate-900 cursor-pointer transition uppercase tracking-widest shadow-sm">
                  View all results
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-2 md:gap-3 lg:gap-4 shrink-0">
          
          <button onClick={openCompare} aria-label="Open compare" className="relative p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition">
            <Scale className="w-5 h-5" />
            {compareItems.length > 0 && <span className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">{compareItems.length}</span>}
          </button>

          <button onClick={() => navigate('/dashboard')} aria-label="Open wishlist" className="relative p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition">
            <Bookmark className="w-5 h-5" />
            {wishlistCount > 0 && <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">{wishlistCount}</span>}
          </button>

          <button onClick={openCart} aria-label="Open shopping bag" className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition sm:mr-2">
            <ShoppingCart className="w-5 h-5" />
            {cartItemCount > 0 && <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">{cartItemCount}</span>}
          </button>

          <div className="hidden sm:block h-6 w-px bg-slate-200"></div>

          {user ? (
            <div {...userMenu.containerProps} className="relative py-1 sm:py-2 sm:pl-2">
              <button
                type="button"
                onClick={userMenu.onTriggerClick}
                aria-haspopup="menu"
                aria-expanded={userMenu.open}
                aria-label="Account menu"
                className="flex items-center gap-2 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {avatarDisplay ? (
                    <img src={avatarDisplay} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="hidden lg:flex flex-col min-w-0"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Account</span><span className="text-sm font-bold text-slate-900 leading-tight max-w-[10rem] truncate">{user.username}</span></div>
              </button>
              
              <div className={`absolute top-full right-0 w-56 max-w-[calc(100vw-1.5rem)] bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 transition-all flex flex-col py-3 z-50 ${userMenu.open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                <Link to="/dashboard" onClick={userMenu.close} className="px-5 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-3 transition"><User className="w-4 h-4"/> Dashboard</Link>
                {user.is_staff && <Link to="/admin" onClick={userMenu.close} className="px-5 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-3 transition"><Shield className="w-4 h-4"/> Admin Console</Link>}
                <div className="border-t border-slate-100 my-2"></div>
                <button onClick={() => { userMenu.close(); onLogout(); }} className="w-full px-5 py-3 text-sm font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition"><LogOut className="w-4 h-4"/> Sign Out</button>
              </div>
            </div>
          ) : (
            <div onClick={onOpenAuth} role="button" tabIndex={0} aria-label="Sign in" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAuth(); } }} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 sm:pl-2 sm:pr-4 sm:py-1.5 rounded-full border border-transparent hover:border-slate-200 transition">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-4 h-4 text-slate-500" /></div>
              <span className="text-sm font-bold text-slate-900 hidden sm:inline">Sign In</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 pt-12 sm:pt-20 pb-8 sm:pb-10 mt-auto border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-16">
        <div className="space-y-4">
          <h3 className="text-white font-bold tracking-widest uppercase text-xs mb-4 sm:mb-6">AuraTech Premium</h3>
          <p className="text-sm font-medium leading-relaxed">The next generation of e-commerce. Powered by intelligent curation and premium design.</p>
        </div>
        <div>
          <h3 className="text-white font-bold tracking-widest uppercase text-xs mb-4 sm:mb-6">Explore</h3>
          <ul className="space-y-3 sm:space-y-4 text-sm font-medium">
            <li><Link to="/" className="hover:text-white transition inline-block py-0.5">Latest Releases</Link></li>
            <li><Link to="/" className="hover:text-white transition inline-block py-0.5">Tech Journal</Link></li>
            <li><Link to="/" className="hover:text-white transition inline-block py-0.5">Privacy & Terms</Link></li>
          </ul>
        </div>
        <div className="sm:col-span-2">
          <h3 className="text-white font-bold tracking-widest uppercase text-xs mb-4 sm:mb-6">Contact & Support</h3>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="bg-slate-900/50 border border-slate-800 p-4 sm:p-6 rounded-2xl flex items-center gap-4 hover:border-slate-700 transition cursor-pointer">
              <Phone className="w-6 h-6 text-white shrink-0" />
              <div><p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Concierge Line</p><p className="text-lg font-bold text-white">16793</p></div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 pt-8 border-t border-slate-900 text-xs font-medium text-slate-600 flex justify-between">
        <p>© 2026 AuraTech Inc. All rights reserved.</p>
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

  const loadProfile = () => {
    fetchProfile().then((data) => setUser(data)).catch(() => setUser(null));
  };

  useEffect(() => { loadProfile(); }, []);

  return (
    <WishlistProvider>
      <CartProvider>
        <CompareProvider>
          <Router>
            <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans w-full max-w-[100vw] overflow-x-hidden">
              <NavigationHeader user={user} onLogout={() => { logoutUser().then(() => window.location.href = '/'); }} onOpenAuth={() => setIsAuthOpen(true)} onOpenMenu={openMenu} />
              <CategoryNavBar categories={categories} products={products} />
              
              <MobileMenu isOpen={isMenuOpen} onClose={closeMenu} categories={categories} products={products} />
              <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onSuccess={() => { setIsAuthOpen(false); loadProfile(); }} />
              <CartDrawer user={user} />
              <CompareDrawer />
              <AIAssistant />

              <main className="flex-1 w-full flex flex-col">
                <Routes>
                  <Route path="/" element={<StorePage onProductSelect={(p) => window.location.href = `/product/${p.id}/${slugify(p.name)}`} />} />
                  <Route path="/product/:id" element={<ProductDetailPageWrapper />} />
                  <Route path="/product/:id/:slug" element={<ProductDetailPageWrapper />} />
                  <Route path="/dashboard" element={<CustomerDashboard user={user} onProfileUpdate={loadProfile} />} />
                  <Route path="/admin" element={<AdminDashboard />} />
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