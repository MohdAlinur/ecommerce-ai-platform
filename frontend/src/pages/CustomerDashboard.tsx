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
      // Using your configured api instance to fetch orders securely
      api.get('/orders/')
        .then(res => setOrders(res.data))
        .catch(console.error);
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
      await updateProfile(form); // Uses the updated api.ts function
      alert('Profile updated successfully!');
      onProfileUpdate(); 
    } catch (err) {
      alert('Failed to update profile.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return <div className="p-20 text-center font-bold">Please log in to view your dashboard.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
      <div className="md:col-span-1 space-y-2">
        <div className="bg-white p-6 rounded-2xl border shadow-sm text-center mb-6">
          <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full overflow-hidden border-4 border-white shadow-md mb-3 flex items-center justify-center">
            {avatarPreview ? <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-slate-300" />}
          </div>
          <h2 className="font-black text-slate-900 text-lg">{user.username}</h2>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>

        <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 p-4 rounded-xl font-bold transition ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>
          <User className="w-5 h-5"/> Account Details
        </button>
        <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 p-4 rounded-xl font-bold transition ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>
          <Package className="w-5 h-5"/> Order History
        </button>
        <button onClick={() => setActiveTab('wishlist')} className={`w-full flex items-center gap-3 p-4 rounded-xl font-bold transition ${activeTab === 'wishlist' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>
          <Bookmark className="w-5 h-5"/> Saved Products <span className="ml-auto bg-slate-900/10 py-0.5 px-2 rounded-full text-xs">{wishlistItems.length}</span>
        </button>
      </div>

      <div className="md:col-span-3">
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Account Details</h2>
            <form onSubmit={handleSaveProfile} className="space-y-6 max-w-lg">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Profile Picture</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border bg-slate-50 flex items-center justify-center shrink-0">
                     {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover"/> : <Camera className="w-6 h-6 text-slate-400"/>}
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username</label>
                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border p-3 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border p-3 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>

              <button type="submit" disabled={isSaving} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition disabled:opacity-70">
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Order History</h2>
            {orders.length === 0 ? <p className="text-slate-500">You haven't placed any orders yet.</p> : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="border rounded-xl p-5 hover:border-indigo-200 transition">
                    <div className="flex justify-between items-start mb-4 border-b pb-4">
                      <div>
                        <h4 className="font-bold text-slate-900">Order #{order.id}</h4>
                        <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {order.status}</span>
                        <p className="font-black text-slate-900 mt-2">৳{Number(order.total_amount).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm text-slate-600">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span className="font-medium">৳{Number(item.price).toLocaleString()}</span>
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
             <h2 className="text-2xl font-black text-slate-900 mb-6 px-1">Saved Products</h2>
             {wishlistItems.length === 0 ? (
               <div className="bg-white rounded-2xl border p-12 text-center text-slate-500">Your wishlist is empty.</div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 {wishlistItems.map((product: Product) => (
                   <ProductCard key={product.id} product={product} />
                 ))}
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};