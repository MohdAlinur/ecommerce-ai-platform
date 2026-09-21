import React, { useState, useEffect } from 'react';
import { useWishlist } from '../context/WishlistContext';
import { ProductCard } from '../components/ProductCard';
import { User, Package, Bookmark, Camera, CheckCircle } from 'lucide-react';
import type { UserProfile, Product } from '../types';
import api, { updateProfile } from '../api';

export const CustomerDashboard: React.FC<{ user: UserProfile | null; onProfileUpdate: () => void }> = ({ user, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'wishlist'>('profile');
  const { wishlistItems } = useWishlist();
  
  const [formData, setFormData] = useState({ username: user?.username || '', email: user?.email || '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar_url ? `http://127.0.0.1:8000${user.avatar_url}` : '');
  const [isSaving, setIsSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'orders') {
      api.get('/orders/').then(res => setOrders(res.data)).catch(console.error);
    }
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      setFormData({ username: user.username || '', email: user.email || '' });
      setAvatarPreview(user.avatar_url ? `http://127.0.0.1:8000${user.avatar_url}` : '');
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
    const form = new FormData();
    form.append('username', formData.username);
    form.append('email', formData.email);
    if (avatarFile) form.append('avatar', avatarFile);

    try {
      await updateProfile(form);
      alert('Profile updated successfully!');
      onProfileUpdate(); 
    } catch (err) {
      alert('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return <div className="p-32 text-center font-bold text-slate-400">Please log in to view your dashboard.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 font-sans">
      <div className="md:col-span-1 space-y-3">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-16 bg-slate-900 rounded-t-3xl"></div>
          <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full overflow-hidden border-4 border-white shadow-md mb-4 flex items-center justify-center relative z-10">
            {avatarPreview ? <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-slate-300" />}
          </div>
          <h2 className="font-black text-slate-900 text-xl tracking-tight">{user.username}</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">{user.email}</p>
        </div>

        <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${activeTab === 'profile' ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-300'}`}>
          <User className="w-5 h-5"/> Account Details
        </button>
        <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-300'}`}>
          <Package className="w-5 h-5"/> Order History
        </button>
        <button onClick={() => setActiveTab('wishlist')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${activeTab === 'wishlist' ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-300'}`}>
          <Bookmark className="w-5 h-5"/> Saved Products 
          <span className={`ml-auto py-1 px-2.5 rounded-full text-xs font-black ${activeTab === 'wishlist' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}>{wishlistItems.length}</span>
        </button>
      </div>

      <div className="md:col-span-3">
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-10">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-8">Account Details</h2>
            <form onSubmit={handleSaveProfile} className="space-y-8 max-w-lg">
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Profile Picture</label>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 shadow-sm">
                     {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover"/> : <Camera className="w-8 h-8 text-slate-300"/>}
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer transition" />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Username</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl text-sm font-semibold focus:outline-none focus:border-slate-900 focus:bg-white transition" />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="px-8 py-3.5 bg-slate-900 text-white font-bold rounded-full shadow-md hover:bg-slate-800 transition disabled:opacity-70 mt-4">
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-10">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-8">Order History</h2>
            {orders.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <Package className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-slate-500 font-bold">You haven't placed any orders yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map(order => (
                  <div key={order.id} className="border border-slate-100 bg-slate-50/50 rounded-3xl p-6 hover:border-slate-300 hover:bg-white transition shadow-sm hover:shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-100 pb-6 gap-4">
                      <div>
                        <h4 className="font-black text-lg text-slate-900 tracking-tight">Order #{order.id}</h4>
                        <p className="text-sm font-medium text-slate-500 mt-1">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 w-max sm:ml-auto"><CheckCircle className="w-3.5 h-3.5"/> {order.status}</span>
                        <p className="font-black text-2xl text-slate-900 mt-3 tracking-tight">৳{Number(order.total_amount).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm font-medium text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                          <span><span className="font-black text-slate-900 mr-2">{item.quantity}x</span> {item.product_name}</span>
                          <span className="font-bold text-slate-900">৳{Number(item.price).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div>
             <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-8 px-2">Saved Products</h2>
             {wishlistItems.length === 0 ? (
               <div className="bg-white rounded-3xl border border-slate-100 py-32 text-center text-slate-400 font-bold flex flex-col items-center">
                 <Bookmark className="w-12 h-12 text-slate-200 mb-4" />
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