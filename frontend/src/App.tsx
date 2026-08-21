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
import { Search, Gift, Zap, User, Shield, LogOut, MapPin, Phone, ChevronDown, ChevronRight, X, ShoppingCart, CreditCard, Smartphone, Truck, Bot, Send, Sparkles, Bookmark } from 'lucide-react';

const slugify = (text: string) => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

function AuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError(''); 
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginUser({ username: formData.username, password: formData.password });
      } else {
        await signupUser(formData);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed.');
    } finally { 
      setLoading(false); 
    }
  };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full"><X className="w-5 h-5" /></button>
        <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg text-center">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" required className="w-full border p-3 rounded-xl text-sm" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Username" />
          {mode === 'signup' && <input type="email" className="w-full border p-3 rounded-xl text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email (Optional)" />}
          <input type="password" required className="w-full border p-3 rounded-xl text-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Password" />
          <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md">{loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </form>
        <div className="mt-6 text-center text-sm text-slate-600">
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-indigo-600 hover:underline">{mode === 'login' ? 'Register Now' : 'Sign In'}</button>
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
      timeoutId = setTimeout(() => {
        setStep('cart');
      }, 300);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
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
            <ShoppingCart className="w-5 h-5 text-indigo-600"/> 
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
              <input type="text" className="w-full border p-2.5 rounded-lg text-sm" value={shippingInfo.name} onChange={e => setShippingInfo({...shippingInfo, name: e.target.value})} placeholder="Full Name" />
              <input type="text" className="w-full border p-2.5 rounded-lg text-sm" value={shippingInfo.phone} onChange={e => setShippingInfo({...shippingInfo, phone: e.target.value})} placeholder="Phone Number" />
              <textarea rows={3} className="w-full border p-2.5 rounded-lg text-sm" value={shippingInfo.address} onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})} placeholder="Delivery Address" />
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
              {paymentMethod === 'bkash' && <div className="bg-white p-4 rounded-xl border border-[#e2136e]/20"><input type="text" placeholder="bKash Number" className="w-full border p-2.5 rounded-lg text-sm" /></div>}

              <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'bg-white'}`}>
                <input type="radio" value="card" className="sr-only" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><CreditCard className="w-5 h-5"/></div>
                <div><h4 className="font-bold">Credit / Debit Card</h4></div>
              </label>
              {paymentMethod === 'card' && (
                <div className="bg-white p-4 rounded-xl border border-indigo-200 space-y-3">
                  <input type="text" placeholder="Card Number" className="w-full border p-2.5 rounded-lg text-sm" />
                  <div className="flex gap-2"><input type="text" placeholder="MM/YY" className="w-1/2 border p-2.5 rounded-lg" /><input type="text" placeholder="CVC" className="w-1/2 border p-2.5 rounded-lg" /></div>
                </div>
              )}

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
              <button onClick={closeCart} className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-sm">Continue Shopping</button>
            </div>
          )}
        </div>

        {step !== 'success' && cartItems?.length > 0 && (
          <div className="p-4 border-t bg-white space-y-3">
            <div className="flex justify-between items-center text-slate-900">
              <span className="font-bold text-slate-500">Subtotal</span>
              <span className="font-black text-lg text-[#ef4a23]">৳{cartTotal.toLocaleString()}</span>
            </div>
            {step === 'cart' && <button onClick={() => { user ? setStep('checkout') : alert('Please log in to checkout.') }} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold">Proceed to Checkout</button>}
            {step === 'checkout' && <button onClick={() => setStep('payment')} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold">Continue to Payment</button>}
            {step === 'payment' && <button onClick={handleCheckout} disabled={isProcessing} className="w-full py-3.5 bg-[#ef4a23] text-white rounded-xl font-bold disabled:opacity-70">{isProcessing ? 'Processing...' : `Pay ৳${cartTotal.toLocaleString()}`}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', content: string}[]>([{ role: 'ai', content: 'Hi! I am your AuraTech AI. How can I help?' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput(''); setIsTyping(true);
    try {
      const history = messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const response = await sendSupportChatMessage(history, userMsg);
      setMessages(prev => [...prev, { role: 'ai', content: response.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Connection error. Try again later.' }]);
    } finally { setIsTyping(false); }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={`fixed bottom-6 right-6 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-2xl transition transform hover:scale-110 flex items-center gap-2 ${isOpen ? 'scale-0' : 'scale-100'}`}>
        <Bot className="w-6 h-6" /><span className="font-bold pr-2 hidden sm:block">AI Assistant</span>
      </button>
      <div className={`fixed bottom-6 right-6 z-50 w-[350px] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100' : 'scale-0 pointer-events-none'}`} style={{ height: '500px' }}>
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-t-2xl flex justify-between items-center text-white"><div className="flex items-center gap-2"><Sparkles className="w-5 h-5" /><h3 className="font-bold">Aura AI Agent</h3></div><button onClick={() => setIsOpen(false)}><X className="w-5 h-5" /></button></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' : 'bg-white border rounded-2xl rounded-bl-sm shadow-sm'}`}>{m.content}</div>
            </div>
          ))}
          {isTyping && <div className="text-xs text-slate-500">AI is typing...</div>}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="p-3 border-t bg-white rounded-b-2xl flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question..." className="flex-1 bg-slate-100 px-4 py-2 rounded-full text-sm outline-none text-slate-900" />
          <button type="submit" disabled={!input.trim() || isTyping} className="bg-indigo-600 text-white p-2 rounded-full disabled:opacity-50"><Send className="w-4 h-4" /></button>
        </form>
      </div>
    </>
  );
};

function CategoryNavBar() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  useEffect(() => { 
    let isMounted = true;
    Promise.all([fetchCategories(), fetchProducts()])
      .then(([cats, prods]) => { 
        if (isMounted) {
          setCategories(cats); 
          setProducts(prods); 
        }
      })
      .catch(console.error);
      
    return () => { isMounted = false; };
  }, []);
  
  const getBrands = (cat: Category) => {
    const matchedProds = products.filter(p => {
      const matchId = p.category === cat.id;
      const matchName = String(p.category_name || '').toLowerCase() === String(cat.name || '').toLowerCase();
      return matchId || matchName;
    });
    return Array.from(new Set(matchedProds.map(p => p.brand).filter(b => b && b.trim() !== '')));
  };

  return (
    <nav className="bg-white border-b shadow-sm sticky top-20 z-40 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-8 text-sm font-bold text-slate-800 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Link to="/" className="hover:text-[#ef4a23] h-full flex items-center transition">All Products</Link>
        {categories.map(cat => {
          const brands = getBrands(cat);
          return (
            <div key={cat.id} className="group/cat relative h-full flex items-center cursor-pointer">
              <Link to={`/?category=${cat.slug}`} className="hover:text-[#ef4a23] transition flex items-center gap-1.5 h-full py-3">
                <span>{cat.name}</span>
                {brands.length > 0 && <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover/cat:text-[#ef4a23] transition" />}
              </Link>
              
              {brands.length > 0 && (
                <div className="absolute top-full left-0 pt-1 w-60 z-50 opacity-0 invisible group-hover/cat:opacity-100 group-hover/cat:visible transition-all duration-200 transform origin-top">
                  <div className="bg-white border border-slate-200 shadow-2xl rounded-b-xl flex flex-col py-2">
                    <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">Categories / Brands</div>
                    {brands.map((brand, idx) => (
                      <div key={idx} className="group/brand relative">
                        <Link 
                          to={`/?search=${encodeURIComponent(brand)}`} 
                          className="px-4 py-2.5 hover:bg-[#ef4a23] hover:text-white text-sm font-semibold text-slate-700 transition flex items-center justify-between"
                        >
                          <span>{brand}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover/brand:text-white transition" />
                        </Link>
                        
                        <div className="absolute top-0 left-full w-48 bg-white border border-slate-200 shadow-2xl rounded-xl py-2 opacity-0 invisible group-hover/brand:opacity-100 group-hover/brand:visible transition-all duration-200 z-50">
                          <div className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">{brand} Lineup</div>
                          <Link to={`/?search=${encodeURIComponent(brand)}`} className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-[#ef4a23] hover:text-white transition">
                            All {brand} Models
                          </Link>
                        </div>
                      </div>
                    ))}
                    <Link to={`/?category=${cat.slug}`} className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-xs font-black text-[#ef4a23] border-t border-slate-100 mt-1 transition text-center uppercase tracking-wider">
                      View All {cat.name}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// --- OPTIMIZED NAVIGATION HEADER WITH LIVE AUTOCOMPLETE SEARCH ---
function NavigationHeader({ user, onLogout, onOpenAuth }: { user: UserProfile | null; onLogout: () => void; onOpenAuth: () => void }) {
  const { cartItems, openCart } = useCart();
  const { wishlistItems } = useWishlist();
  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = wishlistItems.length;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Live search suggestions as user types
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchTerm.trim().length >= 1) {
        try {
          const results = await fetchProducts(undefined, searchTerm.trim());
          setSuggestions(results.slice(0, 5)); // Limit to top 5 suggestions
        } catch (err) {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    }, 250); // 250ms debounce for high performance

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
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
        
        {/* FULLY FUNCTIONAL SEARCH BAR WITH LIVE SUGGESTIONS DROPDOWN */}
        <div ref={searchRef} className="flex-1 max-w-2xl hidden md:block relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Search products, brands..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              className="w-full py-2.5 pl-4 pr-12 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
            />
            <button type="submit" className="absolute right-3 p-1 text-slate-400 hover:text-white transition">
              <Search className="w-5 h-5" />
            </button>
          </form>

          {/* AUTOCOMPLETE SUGGESTIONS DROPDOWN */}
          {isFocused && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 py-2">
              <div className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Suggestions</div>
              {suggestions.map((product) => (
                <div 
                  key={product.id}
                  onClick={() => {
                    setIsFocused(false);
                    setSearchTerm('');
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
              <div 
                onClick={() => {
                  setIsFocused(false);
                  navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`);
                }}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-center text-xs font-bold text-[#3749bb] cursor-pointer border-t border-slate-100 transition"
              >
                View all results for "{searchTerm}"
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 shrink-0">
          
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
    fetchProfile()
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      });
  };

  useEffect(() => { loadProfile(); }, []);

  return (
    <WishlistProvider>
      <CartProvider>
        <Router>
          <div className="min-h-screen bg-[#f2f4f8] text-slate-900 flex flex-col relative">
            <NavigationHeader user={user} onLogout={() => { logoutUser().then(() => window.location.href = '/'); }} onOpenAuth={() => setIsAuthOpen(true)} />
            <CategoryNavBar />
            
            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onSuccess={() => { setIsAuthOpen(false); loadProfile(); }} />
            <CartDrawer user={user} />
            <AIAssistant />

            <main className="flex-1">
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
      </CartProvider>
    </WishlistProvider>
  );
}

function ProductDetailPageWrapper() {
  const { id } = useParams<{ id: string }>();
  return <ProductDetail productId={id} />;
}

export default App;