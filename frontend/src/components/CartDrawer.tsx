import React, { useState } from 'react';
import { X, Trash2, ArrowRight, CheckCircle, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createOrder } from '../api';
import { motion, AnimatePresence } from 'motion/react';

export const CartDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, isCartOpen, closeCart } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Fallback to internal context state if props aren't used properly in App
  const open = isOpen || isCartOpen;
  const handleClose = () => { closeCart(); onClose?.(); };
  
  const totalAmount = cartItems.reduce((total, item) => total + (Number(item.product.cash_discount_price || item.product.price || 0) * item.quantity), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail || cartItems.length === 0) return;
    setIsSubmitting(true);
    try {
      await createOrder({
        customer_name: customerName,
        customer_email: customerEmail,
        items: cartItems.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      });
      clearCart();
      setOrderSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5"/> Your Bag
                </h2>
                <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {orderSuccess ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-100">
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Order Confirmed!</h3>
                  <p className="text-slate-500 text-base leading-relaxed mb-8">Thank you for your purchase. We've sent a receipt to <span className="font-bold text-slate-700">{customerEmail}</span>.</p>
                  <button
                    onClick={() => { setOrderSuccess(false); handleClose(); }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-md transition w-full"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                    {cartItems.length === 0 ? (
                      <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                        <ShoppingBag className="w-12 h-12 mb-4 opacity-50"/>
                        <p className="font-bold text-slate-500">Your bag is empty.</p>
                      </div>
                    ) : (
                      cartItems.map(({ product, quantity }) => (
                        <div key={product.id} className="flex items-center gap-4 bg-white border border-slate-100 p-4 rounded-3xl shadow-sm transition hover:shadow-md">
                          <img
                            src={product.image_display_url || product.image_url || 'https://via.placeholder.com/200'}
                            alt={product.name}
                            className="w-20 h-20 rounded-2xl object-contain bg-slate-50 p-2 border border-slate-100"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm line-clamp-1 tracking-tight mb-1">{product.name}</h4>
                            <span className="text-base font-black text-slate-900 block mb-3">৳{Number(product.cash_discount_price || product.price || 0).toLocaleString()}</span>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center border border-slate-200 rounded-full bg-slate-50 p-0.5">
                                <button
                                  onClick={() => updateQuantity(product.id, quantity - 1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:bg-white hover:shadow-sm transition"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold px-3">{quantity}</span>
                                <button
                                  onClick={() => updateQuantity(product.id, quantity + 1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:bg-white hover:shadow-sm transition"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                onClick={() => removeFromCart(product.id)}
                                className="text-rose-400 hover:text-rose-600 p-2 rounded-full hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {cartItems.length > 0 && (
                    <form onSubmit={handleCheckout} className="p-6 border-t border-slate-100 bg-white space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-500">Subtotal</span>
                        <span className="font-black text-2xl text-slate-900 tracking-tight">৳{totalAmount.toLocaleString()}</span>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white text-sm focus:outline-none focus:border-slate-900 transition"
                        />
                        <input
                          type="email"
                          placeholder="Email Address"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          required
                          className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white text-sm focus:outline-none focus:border-slate-900 transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-full font-bold flex items-center justify-center space-x-2 shadow-md transition disabled:opacity-50 mt-4"
                      >
                        <span>{isSubmitting ? 'Processing...' : 'Secure Checkout'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  )}
                </>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};