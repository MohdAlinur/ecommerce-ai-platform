import React, { useState } from 'react';
import { X, Trash2, ArrowRight, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createOrder } from '../api';
import { motion, AnimatePresence } from 'motion/react';

export const CartDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { cart, removeFromCart, updateQuantity, clearCart, totalAmount } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail || cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await createOrder({
        customer_name: customerName,
        customer_email: customerEmail,
        items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
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
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Your Shopping Cart</h2>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {orderSuccess ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Order Confirmed!</h3>
                  <p className="text-slate-500 text-sm mb-6">Thank you for your purchase. We sent a receipt to {customerEmail}.</p>
                  <button
                    onClick={() => {
                      setOrderSuccess(false);
                      onClose();
                    }}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-md"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {cart.length === 0 ? (
                      <div className="text-center py-16 text-slate-400">
                        <p>Your cart is empty.</p>
                      </div>
                    ) : (
                      cart.map(({ product, quantity }) => (
                        <div key={product.id} className="flex items-center space-x-4 border-b border-slate-100 pb-4">
                          <img
                            src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200'}
                            alt={product.name}
                            className="w-16 h-16 rounded-xl object-cover bg-slate-50"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">{product.name}</h4>
                            <span className="text-sm font-bold text-indigo-600">${parseFloat(product.price).toFixed(2)}</span>
                            <div className="flex items-center space-x-2 mt-2">
                              <button
                                onClick={() => updateQuantity(product.id, quantity - 1)}
                                className="w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
                              >
                                -
                              </button>
                              <span className="text-xs font-semibold px-1">{quantity}</span>
                              <button
                                onClick={() => updateQuantity(product.id, quantity + 1)}
                                className="w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="text-slate-400 hover:text-rose-500 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {cart.length > 0 && (
                    <form onSubmit={handleCheckout} className="p-5 border-t border-slate-100 bg-slate-50 space-y-3">
                      <div className="flex justify-between font-bold text-slate-900 text-lg">
                        <span>Total</span>
                        <span>${totalAmount.toFixed(2)}</span>
                      </div>

                      <input
                        type="text"
                        placeholder="Full Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-sm"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-sm"
                      />

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-indigo-100 shadow-md transition disabled:opacity-50"
                      >
                        <span>{isSubmitting ? 'Processing...' : 'Complete Checkout'}</span>
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