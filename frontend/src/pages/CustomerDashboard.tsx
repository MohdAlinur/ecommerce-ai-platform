import React, { useState, useEffect } from 'react';
import { useWishlist } from '../context/WishlistContext';
import { ProductCard } from '../components/ProductCard';
import {
  User, Package, Bookmark, Camera, CheckCircle, MapPin, Lock,
  CreditCard, Truck, XCircle, AlertCircle
} from 'lucide-react';
import type { UserProfile, Product, OrderData } from '../types';
import api, { updateProfile, cancelCustomerOrder } from '../api';

export const CustomerDashboard: React.FC<{ user: UserProfile | null; onProfileUpdate: () => void }> = ({ user, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'wishlist'>('profile');
  const { wishlistItems } = useWishlist();

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    default_shipping_address: '',
    city: 'Dhaka',
    postal_code: '',
    current_password: '',
    new_password: ''
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const loadOrders = () => {
    setLoadingOrders(true);
    api.get('/orders/')
      .then(res => setOrders(res.data))
      .catch(console.error)
      .finally(() => setLoadingOrders(false));
  };

  useEffect(() => {
    if (activeTab === 'orders' && user) {
      loadOrders();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        default_shipping_address: user.default_shipping_address || user.shipping_address || '',
        city: user.city || 'Dhaka',
        postal_code: user.postal_code || '',
        current_password: '',
        new_password: ''
      });
      setAvatarPreview(
        user.avatar_url
          ? (user.avatar_url.startsWith('http') ? user.avatar_url : `http://127.0.0.1:8000${user.avatar_url}`)
          : ''
      );
    }
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const form = new FormData();
    form.append('name', formData.name);
    form.append('username', formData.username);
    form.append('email', formData.email);
    form.append('phone', formData.phone);
    form.append('default_shipping_address', formData.default_shipping_address);
    form.append('city', formData.city);
    form.append('postal_code', formData.postal_code);
    if (formData.new_password.trim()) {
      form.append('current_password', formData.current_password);
      form.append('new_password', formData.new_password);
    }
    if (avatarFile) form.append('avatar', avatarFile);

    try {
      await updateProfile(form);
      setFormData(prev => ({ ...prev, current_password: '', new_password: '' }));
      setFeedback({ type: 'success', text: 'Your profile and address book have been updated.' });
      onProfileUpdate();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm(`Are you sure you want to cancel Order #${orderId}?`)) return;
    try {
      await cancelCustomerOrder(orderId);
      loadOrders();
      window.dispatchEvent(new CustomEvent('catalog-updated'));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not cancel order.');
    }
  };

  if (!user) {
    return <div className="p-28 text-center font-bold text-slate-400">Please sign in to access your customer account.</div>;
  }

  const inputClass = 'w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-xs font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition';

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-8 font-sans w-full">
      {/* Left Account Navigation */}
      <div className="md:col-span-1 space-y-2.5">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center mb-4 relative overflow-hidden">
          <div className="w-20 h-20 mx-auto bg-slate-100 rounded-full overflow-hidden border-2 border-slate-200 mb-3 flex items-center justify-center">
            {avatarPreview ? <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-slate-400" />}
          </div>
          <h2 className="font-black text-slate-900 text-lg tracking-tight">{user.name || user.username}</h2>
          <p className="text-xs font-medium text-slate-400 mt-0.5">{user.email}</p>
          {user.phone && <p className="text-xs font-bold text-slate-600 mt-1">{user.phone}</p>}
        </div>

        <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-xs font-bold transition-all ${activeTab === 'profile' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-300'}`}>
          <User className="w-4 h-4" /> Profile & Address Book
        </button>
        <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-300'}`}>
          <Package className="w-4 h-4" /> Orders & Invoices
        </button>
        <button onClick={() => setActiveTab('wishlist')} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-xs font-bold transition-all ${activeTab === 'wishlist' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-300'}`}>
          <Bookmark className="w-4 h-4" /> Saved Wishlist
          <span className={`ml-auto py-0.5 px-2 rounded-full text-[10px] font-black ${activeTab === 'wishlist' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}>{wishlistItems.length}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="md:col-span-3">
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Account & Address Book</h2>
            <p className="text-xs text-slate-500 mb-6">Keep your contact and delivery details up to date for 1-click checkout.</p>

            {feedback && (
              <div className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                  {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-slate-300" />}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Profile Photo</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer" />
                </div>
              </div>

              {/* Personal Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="017XXXXXXXX" className={inputClass} />
                </div>
              </div>

              {/* Shipping Address Book */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Default Delivery Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">City</label>
                    <input type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Postal Code</label>
                    <input type="text" value={formData.postal_code} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Street Address</label>
                  <textarea rows={2} value={formData.default_shipping_address} onChange={e => setFormData({ ...formData, default_shipping_address: e.target.value })} placeholder="House, Road, Block, Area" className={`${inputClass} resize-none`} />
                </div>
              </div>

              {/* Password Update */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> Change Password (Optional)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Current Password</label>
                    <input type="password" value={formData.current_password} onChange={e => setFormData({ ...formData, current_password: e.target.value })} placeholder="••••••••" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">New Password (Min 8 chars)</label>
                    <input type="password" value={formData.new_password} onChange={e => setFormData({ ...formData, new_password: e.target.value })} placeholder="Leave blank to keep unchanged" className={inputClass} />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="px-8 py-3.5 bg-slate-900 text-white text-xs font-bold rounded-full shadow-md hover:bg-slate-800 transition disabled:opacity-70">
                {isSaving ? 'Saving Changes...' : 'Save Account Settings'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-6">Order History & Receipts</h2>
            {loadingOrders ? (
              <div className="py-16 text-center text-xs font-bold text-slate-400">Loading your orders...</div>
            ) : orders.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <Package className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm font-bold">You haven't placed any orders yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map(order => (
                  <div key={order.id} className="border border-slate-200/80 bg-slate-50/40 rounded-3xl p-5 sm:p-6 transition hover:bg-white">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-black text-base text-slate-900">Order #{order.id}</h4>
                          {order.transaction_id && (
                            <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">
                              {order.transaction_id}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Placed on {new Date(order.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.payment_status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          order.payment_status === 'REFUNDED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {order.payment_status} • {order.masked_card || order.payment_method.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'bg-emerald-600 text-white' :
                          order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-900 text-white'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Customer & Payment Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs bg-white p-3.5 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Delivery Address</span>
                        <p className="font-bold text-slate-800 mt-0.5">{order.customer_name} ({order.phone})</p>
                        <p className="text-slate-500">{order.shipping_address}, {order.city}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment & Tracking</span>
                        {order.masked_card && <p className="font-bold text-slate-800 mt-0.5"><CreditCard className="w-3.5 h-3.5 inline mr-1" /> {order.masked_card} ({order.card_holder_name})</p>}
                        {order.bkash_trx_id && <p className="font-bold text-slate-800 mt-0.5">TrxID: {order.bkash_trx_id} ({order.payment_phone})</p>}
                        {order.tracking_number ? (
                          <p className="text-indigo-600 font-bold mt-0.5"><Truck className="w-3.5 h-3.5 inline mr-1" /> Tracking: {order.tracking_number} ({order.courier_name || 'Courier'})</p>
                        ) : (
                          <p className="text-slate-400 mt-0.5">Awaiting courier dispatch</p>
                        )}
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2 mb-4">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-xs bg-white p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="font-black text-slate-900 mr-2">{item.quantity}x</span>
                            <span className="font-semibold text-slate-700">{item.product_name}</span>
                            {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                              <span className="ml-2 text-[11px] text-slate-400">
                                ({Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(', ')})
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-slate-900">৳{Number(item.price).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* Footer Total & Cancel Action */}
                    <div className="flex flex-wrap justify-between items-center pt-3 border-t border-slate-100 gap-3">
                      <div className="text-xs text-slate-500">
                        Total Paid/Payable: <strong className="text-base font-black text-slate-900 ml-1">৳{Number(order.total_amount).toLocaleString()}</strong>
                      </div>
                      {(order.status === 'PENDING' || order.status === 'PROCESSING') && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 px-4 py-1.5 rounded-full transition flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-6">Saved Products</h2>
            {wishlistItems.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 py-24 text-center text-slate-400 font-bold flex flex-col items-center">
                <Bookmark className="w-10 h-10 text-slate-200 mb-3" />
                Your wishlist is empty.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlistItems.map((product: Product) => (
                  <div key={product.id} className="h-full">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};