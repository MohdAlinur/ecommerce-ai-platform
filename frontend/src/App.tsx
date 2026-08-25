import React, { useState, useEffect, useRef } from 'react';
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
import { Search, User, Shield, LogOut, Phone, ChevronDown, ChevronRight, X, ShoppingCart, CreditCard, Smartphone, Truck, Bot, Send, Sparkles, Bookmark, Scale, Eye, EyeOff, Menu } from 'lucide-react';

const slugify = (text: string) => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

function AuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        (window as any).google.accounts.id.renderButton(
          document.getElementById('googleSignInDiv'),
          { theme: 'outline', size: 'large', width: 350 }
        );
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition"><X className="w-5 h-5" /></button>
        
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-slate-900 mb-1">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-sm text-slate-500">{mode === 'login' ? 'Sign in to your account' : 'Join to start shopping'}</p>
        </div>

        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg text-center">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Name <span className="text-rose-500">*</span></label>
              <input type="text" required className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Enter full name" />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email address <span className="text-rose-500">*</span></label>
            <input type="email" required className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Enter email address" />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone number <span className="text-rose-500">*</span></label>
              <input type="tel" required className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Phone number" />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">Password <span className="text-rose-500">*</span></label>
              {mode === 'signup' && <span className="text-[10px] text-slate-400 font-semibold">Minimum 8 characters</span>}
            </div>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required className="w-full border border-slate-200 p-3 pr-10 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Enter password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Repeat password <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} required className="w-full border border-slate-200 p-3 pr-10 rounded-xl text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} placeholder="Confirm password" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="flex items-center justify-between text-xs py-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                <span className="font-semibold">Remember me</span>
              </label>
              <a href="#" className="text-indigo-600 font-bold hover:underline">Forgotten password?</a>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-[#3749bb] hover:bg-indigo-800 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-70 mt-2">
            {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center space-x-2">
          <span className="h-px bg-slate-200 flex-1"></span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Or</span>
          <span className="h-px bg-slate-200 flex-1"></span>
        </div>

        <div id="googleSignInDiv" className="mt-6 flex justify-center w-full"></div>

        <div className="mt-6 text-center text-sm font-medium text-slate-600">
          {mode === 'login' ? "Don't have an account? " : "Already registered? "}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-[#3749bb] font-bold hover:underline">
            {mode === 'login' ? 'Register now' : 'Sign in'}
          </button>
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

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeCart}></div>
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#3749bb]"/> 
            {step === 'cart' ? 'Your Cart' : step === 'success' ? 'Order Complete' : 'Secure Checkout'}
          </h2>
          <button onClick={closeCart} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {step === 'cart' && (
            cartItems.length === 0 ? <div className="text-center text-slate-500 mt-20 font-semibold">Your cart is empty.</div> :
            cartItems.map((item, idx) => (
              <div key={idx} className="flex gap-4 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <img src={item.product.image_display_url || item.product.image_url} alt={item.product.name} className="w-20 h-20 object-contain rounded-lg border p-1" />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-2">{item.product.name}</h4>
                    <p className="text-[#ef4a23] font-black text-sm mt-1">৳{Number(item.product.cash_discount_price || item.product.price || 0).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border rounded-md">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="px-2 py-1 font-bold">-</button>
                      <span className="px-3 text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="px-2 py-1 font-bold">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-xs text-rose-500 hover:underline font-bold">Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}

          {step === 'checkout' && (
            <div className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
              <h3 className="font-bold text-slate-900">Shipping Details</h3>
              <input type="text" className="w-full border p-2.5 rounded-lg text-sm focus:border-[#3749bb] outline-none" value={shippingInfo.name} onChange={e => setShippingInfo({...shippingInfo, name: e.target.value})} placeholder="Full Name" />
              <input type="text" className="w-full border p-2.5 rounded-lg text-sm focus:border-[#3749bb] outline-none" value={shippingInfo.phone} onChange={e => setShippingInfo({...shippingInfo, phone: e.target.value})} placeholder="Phone Number" />
              <textarea rows={3} className="w-full border p-2.5 rounded-lg text-sm focus:border-[#3749bb] outline-none" value={shippingInfo.address} onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})} placeholder="Delivery Address" />
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 px-1">Payment Method</h3>
              <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${paymentMethod === 'bkash' ? 'border-[#e2136e] bg-[#e2136e]/5 ring-1 ring-[#e2136e]' : 'bg-white'}`}>
                <input type="radio" value="bkash" className="sr-only" checked={paymentMethod === 'bkash'} onChange={() => setPaymentMethod('bkash')} />
                <div className="w-10 h-10 bg-[#e2136e] rounded-lg flex items-center justify-center text-white"><Smartphone className="w-5 h-5"/></div>
                <div><h4 className="font-bold">bKash Mobile Banking</h4></div>
              </label>
              {paymentMethod === 'bkash' && <div className="bg-white p-4 rounded-xl border border-[#e2136e]/20"><input type="text" placeholder="bKash Number" className="w-full border p-2.5 rounded-lg text-sm outline-none focus:border-[#e2136e]" /></div>}

              <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${paymentMethod === 'card' ? 'border-[#3749bb] bg-indigo-50 ring-1 ring-[#3749bb]' : 'bg-white'}`}>
                <input type="radio" value="card" className="sr-only" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                <div className="w-10 h-10 bg-[#3749bb] rounded-lg flex items-center justify-center text-white"><CreditCard className="w-5 h-5"/></div>
                <div><h4 className="font-bold">Credit / Debit Card</h4></div>
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${paymentMethod === 'cod' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'bg-white'}`}>
                <input type="radio" value="cod" className="sr-only" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white"><Truck className="w-5 h-5"/></div>
                <div><h4 className="font-bold">Cash on Delivery</h4></div>
              </label>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center mt-20 space-y-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><Shield className="w-10 h-10"/></div>
              <h3 className="text-2xl font-black text-slate-900">Order Confirmed!</h3>
              <button onClick={closeCart} className="mt-6 px-6 py-2.5 bg-[#3749bb] text-white font-bold rounded-xl shadow-sm hover:bg-indigo-900 transition">Continue Shopping</button>
            </div>
          )}
        </div>

        {step !== 'success' && cartItems?.length > 0 && (
          <div className="p-4 border-t bg-white space-y-3">
            <div className="flex justify-between items-center text-slate-900">
              <span className="font-bold text-slate-500">Subtotal</span>
              <span className="font-black text-lg text-[#ef4a23]">৳{cartTotal.toLocaleString()}</span>
            </div>
            {step === 'cart' && <button onClick={() => { user ? setStep('checkout') : alert('Please log in to checkout.') }} className="w-full py-3.5 bg-[#3749bb] hover:bg-indigo-900 text-white rounded-xl font-bold transition">Proceed to Checkout</button>}
            {step === 'checkout' && <button onClick={() => setStep('payment')} className="w-full py-3.5 bg-[#3749bb] hover:bg-indigo-900 text-white rounded-xl font-bold transition">Continue to Payment</button>}
            {step === 'payment' && <button onClick={handleCheckout} disabled={isProcessing} className="w-full py-3.5 bg-[#ef4a23] hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-70 transition">{isProcessing ? 'Processing...' : `Pay ৳${cartTotal.toLocaleString()}`}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function CompareDrawer() {
  const { compareItems, removeFromCompare, clearCompare, isCompareOpen, closeCompare } = useCompare();

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
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeCompare}></div>
      <div className="relative w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#3749bb]"/> Product Comparison <span className="text-sm font-medium text-slate-500">({compareItems.length}/4)</span>
          </h2>
          <button onClick={closeCompare} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {compareItems.length === 0 ? (
            <div className="text-center mt-32 space-y-2">
              <Scale className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900">No Products Selected</h3>
              <p className="text-sm text-slate-500">You have not chosen any products to compare.</p>
            </div>
          ) : (
            <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
              {compareItems.map((product) => (
                <div key={product.id} className="min-w-[240px] w-full sm:w-1/2 md:w-1/3 lg:w-1/4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden shrink-0">
                  <button onClick={() => removeFromCompare(product.id)} className="absolute top-2 right-2 p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full transition z-10">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="p-4 h-48 flex items-center justify-center border-b border-slate-50">
                    <img src={product.image_display_url || product.image_url} alt={product.name} className="max-h-full object-contain" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{product.brand || product.category_name}</span>
                    <h3 className="font-bold text-sm text-slate-900 mb-2 line-clamp-2">{product.name}</h3>
                    <p className="text-[#ef4a23] font-black text-lg mb-4">৳{Number(product.cash_discount_price || product.price || 0).toLocaleString()}</p>
                    
                    <div className="mt-auto space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 border-b pb-1">Key Features:</h4>
                      <ul className="text-xs text-slate-600 space-y-1">
                        {Array.isArray(product.key_features) && product.key_features.slice(0, 4).map((f, i) => (
                          <li key={i} className="line-clamp-1 flex gap-1"><span className="text-[#3749bb]">•</span> {typeof f === 'string' ? f : JSON.stringify(f)}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
              
              {compareItems.length < 4 && (
                <div className="min-w-[240px] w-full sm:w-1/2 md:w-1/3 lg:w-1/4 bg-slate-100/50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-6 text-center shrink-0">
                  <Search className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm font-bold">Add another product<br/>to compare</p>
                </div>
              )}
            </div>
          )}
        </div>

        {compareItems.length > 0 && (
          <div className="p-4 border-t bg-white flex gap-3">
            <button onClick={clearCompare} className="px-4 py-3 border font-bold text-slate-600 rounded-xl hover:bg-slate-50 transition w-1/3 md:w-1/4">Clear All</button>
            <button 
              onClick={handleAICompare} 
              disabled={compareItems.length < 2}
              className="flex-1 py-3 bg-gradient-to-r from-[#3749bb] to-indigo-800 hover:from-indigo-800 hover:to-indigo-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-50 transition"
            >
              <Sparkles className="w-4 h-4" /> Compare with AI Agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// UPDATED AI ASSISTANT: True Mobile Responsive Slide-Up Drawer
// --------------------------------------------------------------------------------
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
    "Find a gaming laptop under ৳100,000",
    "What's the best monitor for office work?",
    "Help me choose a budget smartphone"
  ];

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={`fixed bottom-6 right-6 z-40 bg-[#3749bb] text-white p-4 rounded-full shadow-2xl transition transform hover:scale-110 flex items-center gap-2 ${isOpen ? 'scale-0' : 'scale-100'}`}>
        <Bot className="w-6 h-6" /><span className="font-bold pr-2 hidden sm:block">AI Assistant</span>
      </button>

      {/* MOBILE-FRIENDLY BOTTOM DRAWER CHAT INTERFACE */}
      <div className={`fixed bottom-0 sm:bottom-6 right-0 sm:right-6 z-50 w-full sm:w-[380px] h-[85vh] sm:h-[550px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col transition-transform duration-300 transform origin-bottom sm:origin-bottom-right ${isOpen ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-0 sm:scale-0 pointer-events-none'}`}>
        
        <div className="bg-gradient-to-r from-[#3749bb] to-indigo-800 p-4 rounded-t-2xl flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" /><h3 className="font-bold">Aura AI Agent</h3></div>
          <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 text-sm whitespace-pre-wrap leading-relaxed ${m.role === 'user' ? 'bg-[#3749bb] text-white rounded-2xl rounded-br-sm' : 'bg-white border border-slate-200 shadow-sm rounded-2xl rounded-bl-sm text-slate-800'}`}>
                {m.content}
              </div>
            </div>
          ))}
          
          {messages.length === 1 && !isTyping && (
            <div className="flex flex-col gap-2 mt-4">
              {quickActions.map((action, idx) => (
                <button key={idx} onClick={() => handleSend(action)} className="text-[12px] bg-white border border-indigo-100 text-[#3749bb] px-3 py-2 rounded-xl shadow-sm hover:bg-indigo-50 transition-colors text-left font-semibold">
                  {action}
                </button>
              ))}
            </div>
          )}

          {isTyping && <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse"/> AI is thinking...</div>}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="p-3 border-t bg-white sm:rounded-b-2xl flex gap-2 shrink-0">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about any product..." className="flex-1 bg-slate-100 px-4 py-2.5 rounded-full text-sm outline-none text-slate-900 focus:ring-1 focus:ring-[#3749bb]" />
          <button type="submit" disabled={!input.trim() || isTyping} className="bg-[#3749bb] text-white p-2.5 rounded-full shadow-sm disabled:opacity-50 hover:bg-indigo-800 transition"><Send className="w-4 h-4" /></button>
        </form>

      </div>
    </>
  );
};

function CategoryNavBar() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAllMenu, setShowAllMenu] = useState(false);
  
  useEffect(() => { 
    let isMounted = true;
    Promise.all([fetchCategories(), fetchProducts()]).then(([cats, prods]) => { 
      if (isMounted) { setCategories(cats); setProducts(prods); }
    }).catch(console.error);
    return () => { isMounted = false; };
  }, []);
  
  const getBrands = (cat: Category) => {
    const matchedProds = products.filter(p => {
      return String(p.category) === String(cat.id) || String(p.category_name || '').toLowerCase() === String(cat.name || '').toLowerCase();
    });
    return Array.from(new Set(matchedProds.map(p => p.brand).filter(b => Boolean(b) && String(b).trim() !== '')));
  };

  const topCategories = [...categories].sort((a, b) => {
    const aCount = products.filter(p => String(p.category) === String(a.id) || p.category_name === a.name).length;
    const bCount = products.filter(p => String(p.category) === String(b.id) || p.category_name === b.name).length;
    return bCount - aCount;
  }).slice(0, 8); 

  return (
    <nav className="bg-[#232f3e] text-white border-b border-[#131a22] shadow-sm sticky top-20 z-40 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-10 text-sm font-medium relative z-50">
        
        <div 
          className="h-full flex items-center relative"
          onMouseEnter={() => setShowAllMenu(true)}
          onMouseLeave={() => setShowAllMenu(false)}
        >
          <button className="flex items-center gap-1.5 hover:text-white px-2 py-1 border border-transparent hover:border-white rounded-sm transition h-8 mr-2 font-bold cursor-default">
            <Menu className="w-5 h-5"/> All
          </button>

          {showAllMenu && (
            <div className="absolute top-[100%] left-0 bg-white border border-slate-200 shadow-2xl rounded-b-lg w-72 max-h-[75vh] overflow-y-auto z-[60] py-2 text-slate-800 custom-scrollbar">
              <div className="px-5 py-3 font-black text-lg text-slate-900 border-b mb-2">Shop By Category</div>
              {categories.map(cat => (
                <Link 
                  key={cat.id} 
                  to={`/?category=${cat.slug}`} 
                  onClick={() => setShowAllMenu(false)}
                  className="block px-5 py-2.5 hover:bg-slate-100 hover:text-[#ef4a23] transition text-sm font-semibold"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center h-full gap-1 relative z-50">
           <Link to="/" className="hover:text-white px-2 py-1 border border-transparent hover:border-white rounded-sm transition whitespace-nowrap">Today's Deals</Link>
           <Link to="/" className="hover:text-white px-2 py-1 border border-transparent hover:border-white rounded-sm transition whitespace-nowrap">Customer Service</Link>
           {topCategories.map(cat => {
             const brands = getBrands(cat);
             return (
               <div key={cat.id} className="group/nav h-full flex items-center relative">
                 <Link to={`/?category=${cat.slug}`} className="hover:text-white px-2 py-1 border border-transparent hover:border-white rounded-sm transition whitespace-nowrap flex items-center gap-1">
                   {cat.name}
                   {brands.length > 0 && <ChevronDown className="w-3 h-3 opacity-70" />}
                 </Link>
                 {brands.length > 0 && (
                    <ul className="absolute hidden group-hover/nav:block top-[100%] left-0 bg-white border border-slate-200 shadow-xl rounded-b-md w-48 z-[60] py-2 text-slate-800">
                      {brands.map((brand, idx) => (
                        <li key={idx}>
                          <Link to={`/?search=${encodeURIComponent(brand)}`} className="block px-4 py-2 text-sm font-medium hover:bg-slate-100 hover:text-[#ef4a23] transition">
                            {brand}
                          </Link>
                        </li>
                      ))}
                      <li className="bg-slate-50 border-t border-slate-100 mt-1">
                        <Link to={`/?category=${cat.slug}`} className="block px-4 py-2.5 text-center text-xs font-black text-[#3749bb] hover:text-[#ef4a23] transition uppercase tracking-wider">
                          View All {cat.name}
                        </Link>
                      </li>
                    </ul>
                 )}
               </div>
             );
           })}
        </div>

      </div>
    </nav>
  );
}

function NavigationHeader({ user, onLogout, onOpenAuth }: { user: UserProfile | null; onLogout: () => void; onOpenAuth: () => void }) {
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
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsFocused(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    <header className="bg-[#081621] text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-8">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center font-black text-xl">AT</div>
          <div><h1 className="font-black text-2xl tracking-tight leading-none">AuraTech</h1><span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Smart E-Commerce</span></div>
        </Link>
        
        <div ref={searchRef} className="flex-1 max-w-2xl hidden md:block relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Search products, brands..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              className="w-full py-2.5 pl-4 pr-12 rounded-lg bg-[#142330] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] transition"
            />
            <button type="submit" className="absolute right-3 p-1 text-slate-400 hover:text-white transition">
              <Search className="w-5 h-5" />
            </button>
          </form>

          {isFocused && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 py-2">
              <div className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Suggestions</div>
              {suggestions.map((product) => (
                <div 
                  key={product.id}
                  onClick={() => {
                    setIsFocused(false); setSearchTerm('');
                    navigate(`/product/${product.id}/${slugify(product.name)}`);
                  }}
                  className="px-4 py-3 hover:bg-slate-50 transition flex items-center gap-3 cursor-pointer border-b border-slate-50 last:border-0"
                >
                  <img src={product.image_display_url || product.image_url} alt={product.name} className="w-12 h-12 object-contain rounded-lg border bg-white p-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 truncate">{product.name}</h4>
                    <p className="text-xs text-slate-500">{product.brand || product.category_name}</p>
                  </div>
                  <span className="font-black text-sm text-[#ef4a23] shrink-0">৳{Number(product.cash_discount_price || product.price || 0).toLocaleString()}</span>
                </div>
              ))}
              <div onClick={() => { setIsFocused(false); navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`); }} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-center text-xs font-bold text-[#3749bb] cursor-pointer border-t border-slate-100 transition">
                View all results for "{searchTerm}"
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 shrink-0">
          
          <button onClick={openCompare} className="relative flex items-center gap-2 cursor-pointer hover:text-indigo-400 transition text-white">
            <div className="relative">
              <Scale className="w-6 h-6" />
              {compareItems.length > 0 && <span className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">{compareItems.length}</span>}
            </div>
          </button>

          <button onClick={() => navigate('/dashboard')} className="relative flex items-center gap-2 cursor-pointer hover:text-indigo-400 transition text-white">
            <div className="relative">
              <Bookmark className="w-6 h-6" />
              {wishlistCount > 0 && <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">{wishlistCount}</span>}
            </div>
          </button>

          <button onClick={openCart} className="relative flex items-center gap-2 cursor-pointer hover:text-indigo-400 transition text-white">
            <div className="relative">
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && <span className="absolute -top-2 -right-2 bg-[#ef4a23] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">{cartItemCount}</span>}
            </div>
          </button>

          {user ? (
            <div className="flex items-center gap-2 group relative cursor-pointer py-4">
              {avatarDisplay ? (
                <img src={avatarDisplay} alt="Profile" className="w-8 h-8 rounded-full border-2 border-indigo-500 object-cover" />
              ) : (
                <User className="w-6 h-6 text-indigo-500" />
              )}
              <div className="flex flex-col hidden sm:flex"><span className="text-xs font-bold">Account</span><span className="text-[10px] text-slate-400">{user.username}</span></div>
              
              <div className="absolute top-[100%] right-0 w-48 bg-white rounded-lg shadow-xl border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-slate-800 flex flex-col py-2 z-50">
                <Link to="/dashboard" className="px-4 py-2 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2"><User className="w-4 h-4"/> Dashboard</Link>
                {user.is_staff && <Link to="/admin" className="px-4 py-2 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2"><Shield className="w-4 h-4"/> Admin Panel</Link>}
                <button onClick={onLogout} className="px-4 py-2 text-sm font-semibold hover:bg-rose-50 text-rose-600 flex items-center gap-2"><LogOut className="w-4 h-4"/> Logout</button>
              </div>
            </div>
          ) : (
            <div onClick={onOpenAuth} className="flex items-center gap-2 cursor-pointer hover:text-indigo-400 transition py-4">
              <User className="w-6 h-6 text-indigo-500" />
              <div className="flex flex-col hidden sm:flex"><span className="text-xs font-bold">Account</span><span className="text-[10px] text-slate-400">Register / Login</span></div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-[#081621] text-slate-300 pt-16 pb-8 border-t-4 border-indigo-600 mt-12">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        <div className="space-y-4">
          <h3 className="text-white font-bold tracking-widest uppercase mb-6">Support</h3>
          <div className="flex items-center gap-4 p-4 border border-slate-700 rounded-lg hover:border-indigo-500 transition cursor-pointer">
            <Phone className="w-8 h-8 text-indigo-500" /><div><p className="text-xs text-slate-400">9 AM - 8 PM</p><p className="text-xl font-black text-rose-500">16793</p></div>
          </div>
        </div>
        <div>
          <h3 className="text-white font-bold tracking-widest uppercase mb-6">About Us</h3>
          <ul className="space-y-3 text-sm font-medium">
            <li><Link to="/" className="hover:text-indigo-400">EMI Terms</Link></li>
            <li><Link to="/" className="hover:text-indigo-400">Privacy Policy</Link></li>
            <li><Link to="/" className="hover:text-indigo-400">Brands</Link></li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <h3 className="text-white font-bold tracking-widest uppercase mb-6">Stay Connected</h3>
          <p className="text-sm font-bold text-white mb-2">AuraTech Ltd</p>
          <p className="text-sm text-slate-400 mb-4">Head Office: 28 Kazi Nazrul Islam Ave, Dhaka 1000</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 pt-8 border-t border-slate-800 flex justify-between text-xs text-slate-500">
        <p>© 2026 AuraTech Ltd | All rights reserved</p>
      </div>
    </footer>
  );
}

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const loadProfile = () => {
    fetchProfile().then((data) => setUser(data)).catch(() => setUser(null));
  };

  useEffect(() => { loadProfile(); }, []);

  return (
    <WishlistProvider>
      <CartProvider>
        <CompareProvider>
          <Router>
            <div className="min-h-screen bg-[#f2f4f8] text-slate-900 flex flex-col relative overflow-x-hidden">
              <NavigationHeader user={user} onLogout={() => { logoutUser().then(() => window.location.href = '/'); }} onOpenAuth={() => setIsAuthOpen(true)} />
              <CategoryNavBar />
              
              <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onSuccess={() => { setIsAuthOpen(false); loadProfile(); }} />
              <CartDrawer user={user} />
              <CompareDrawer />
              <AIAssistant />

              <main className="flex-1 flex flex-col">
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