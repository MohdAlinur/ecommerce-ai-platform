import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Tag, Image as ImageIcon, 
  Plus, Trash2, Edit2, Shield, CheckCircle, Truck, X, Upload, Layers, Info, ListTree, ImagePlus, Box
} from 'lucide-react';
import type { AnalyticsData, Category, Product, UserProfile } from '../types';
import api, { 
  fetchAdminAnalytics, fetchCategories, createCategory, createProduct, 
  updateProduct, deleteProduct, fetchAllUsers, deleteUserAccount, 
  fetchProducts, createAdminUser, bulkImportCSV, bulkDeleteProducts 
} from '../api';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'orders' | 'crm' | 'marketing' | 'cms'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '', email: '', password: '' });

  // NEW: State to track which products are selected for bulk deletion
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const [productFormTab, setProductFormTab] = useState<'vital' | 'offer' | 'variants' | 'images' | 'description'>('vital');
  
  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showBrandInput, setShowBrandInput] = useState(false);
  const existingBrands = Array.from(new Set(products.map(p => p.brand).filter(b => b && b.trim() !== ''))) as string[];

  const defaultSpecs = [
    { groupName: 'Additional details', features: [{ key: 'Operating System', value: '' }, { key: 'RAM', value: '' }] },
    { groupName: 'Display', features: [{ key: 'Size', value: '' }, { key: 'Resolution', value: '' }] },
    { groupName: 'Battery', features: [{ key: 'Capacity', value: '' }] },
    { groupName: 'Connectivity', features: [{ key: 'Network', value: '' }] },
    { groupName: 'Measurements', features: [{ key: 'Dimensions', value: '' }, { key: 'Weight', value: '' }] },
    { groupName: 'Item details', features: [{ key: 'Manufacturer', value: '' }, { key: 'Model', value: '' }] },
    { groupName: 'Navigation', features: [{ key: 'GPS', value: '' }] }
  ];

  const [newProd, setNewProd] = useState({
    name: '', category: '', brand: '', product_code: '', description: '', whats_in_box: '',
    cash_discount_price: '0', regular_price: '0', stock: 10, 
    image_url: '', image_gallery: [] as string[], 
    variants: [] as { name: string, options: string }[], 
    key_features_text: '', 
    specifications: defaultSpecs
  });

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, catsRes, usersRes, prodsRes, ordersRes, reviewsRes, discountRes, bannersRes] = await Promise.all([
        fetchAdminAnalytics(), fetchCategories(), fetchAllUsers(), fetchProducts(),
        api.get('/orders/').then(r => r.data),
        api.get('/reviews/').then(r => r.data),
        api.get('/discounts/').then(r => r.data),
        api.get('/banners/').then(r => r.data)
      ]);
      
      setData(analyticsRes); setCategories(catsRes); setUsers(usersRes); setProducts(prodsRes);
      setOrders(ordersRes); setReviews(reviewsRes); setDiscounts(discountRes); setBanners(bannersRes);
      setError(null);
    } catch {
      setError("Access Denied: Admin authorization required.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); }, []);

  // Clear selections when changing tabs
  useEffect(() => { setSelectedProductIds([]); }, [activeTab]);

  const handleInlineCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await createCategory(newCatName.trim());
      setCategories([...categories, created]);
      setNewProd({ ...newProd, category: String(created.id) });
      setNewCatName('');
      setShowCatInput(false);
    } catch { alert('Failed to create category.'); }
  };

  const handleOpenEditModal = (p: any) => {
    setEditingProductId(p.id);
    const featuresStr = Array.isArray(p.key_features) ? p.key_features.join('\n') : '';
    setNewProd({
      name: p.name || '', category: String(p.category || ''), brand: p.brand || '', product_code: p.product_code || '',
      description: p.description || '', whats_in_box: '', cash_discount_price: String(p.cash_discount_price || '0'),
      regular_price: String(p.regular_price || '0'), stock: p.stock ?? 10, 
      image_url: p.image_url || '', image_gallery: p.image_gallery || [], 
      variants: p.variants ? p.variants.map((v:any) => ({ name: v.name, options: v.options.join(', ') })) : [],
      key_features_text: featuresStr,
      specifications: Array.isArray(p.specifications) && p.specifications.length > 0 ? p.specifications : defaultSpecs
    });
    if (p.brand && !existingBrands.includes(p.brand)) setShowBrandInput(true);
    setProductFormTab('vital');
    setShowAddModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm('Delete this product?')) {
      try { await deleteProduct(id); loadAdminData(); } catch { alert('Failed to delete.'); }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedProductIds.length} products?`)) {
      try {
        await bulkDeleteProducts(selectedProductIds);
        setSelectedProductIds([]);
        loadAdminData();
      } catch {
        alert('Failed to execute bulk deletion.');
      }
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedProductIds(products.map(p => p.id));
    else setSelectedProductIds([]);
  };

  const handleSelectOne = (id: number) => {
    if (selectedProductIds.includes(id)) setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
    else setSelectedProductIds([...selectedProductIds, id]);
  };

  const handleCsvUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return alert('Please select a CSV file.');
    try {
      await bulkImportCSV(csvFile);
      alert('Products successfully imported via CSV!');
      setShowCsvModal(false); setCsvFile(null); loadAdminData();
    } catch { alert('Failed to import CSV file. Ensure columns match exactly.'); }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string, tracking?: string, courier?: string) => {
    try { await api.patch(`/orders/${orderId}/`, { status, tracking_number: tracking, courier_name: courier }); loadAdminData(); } catch { alert('Failed to update order status'); }
  };

  const handleCreateDiscount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    try { await api.post('/discounts/', { code: fd.get('code'), discount_percent: fd.get('percent'), usage_limit: fd.get('limit') }); loadAdminData(); (e.target as HTMLFormElement).reset(); } catch { alert('Failed to create discount'); }
  };

  const handleModerateReview = async (reviewId: number, is_approved: boolean) => {
    try { await api.patch(`/reviews/${reviewId}/`, { is_approved }); loadAdminData(); } catch { alert('Failed to moderate review'); }
  };

  const handleCreateBanner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    try { await api.post('/banners/', { title: fd.get('title'), image_url: fd.get('image'), link: fd.get('link') }); loadAdminData(); (e.target as HTMLFormElement).reset(); } catch { alert('Failed to create banner'); }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', newProd.name); 
    formData.append('category', String(newProd.category));
    formData.append('brand', newProd.brand); 
    formData.append('product_code', newProd.product_code);
    
    const finalDesc = newProd.whats_in_box ? `${newProd.description}\n\n<b>What is in the box?</b>\n<ul><li>${newProd.whats_in_box.replace(/\n/g, '</li><li>')}</li></ul>` : newProd.description;
    formData.append('description', finalDesc); 

    formData.append('cash_discount_price', newProd.cash_discount_price);
    formData.append('regular_price', newProd.regular_price); 
    formData.append('stock', String(newProd.stock)); 
    formData.append('image_url', newProd.image_url);
    
    formData.append('key_features', JSON.stringify(newProd.key_features_text.split('\n').filter(f => f.trim() !== '')));
    formData.append('specifications', JSON.stringify(newProd.specifications));
    formData.append('image_gallery', JSON.stringify(newProd.image_gallery.filter(url => url.trim() !== '')));
    
    const formattedVariants = newProd.variants.filter(v => v.name.trim() !== '').map(v => ({
      name: v.name, options: v.options.split(',').map(o => o.trim()).filter(o => o !== '')
    }));
    formData.append('variants', JSON.stringify(formattedVariants));

    try {
      if (editingProductId !== null) await updateProduct(editingProductId, formData);
      else await createProduct(formData);
      setShowAddModal(false); loadAdminData();
    } catch { alert('Error saving product.'); }
  };

  const addSpecGroup = () => setNewProd({ ...newProd, specifications: [...newProd.specifications, { groupName: 'New Group', features: [{ key: '', value: '' }] }] });
  const removeSpecGroup = (idx: number) => setNewProd({ ...newProd, specifications: newProd.specifications.filter((_, i) => i !== idx) });
  const addSpecFeature = (idx: number) => { const updated = [...newProd.specifications]; updated[idx].features.push({ key: '', value: '' }); setNewProd({ ...newProd, specifications: updated }); };
  const removeSpecFeature = (gIdx: number, fIdx: number) => { const updated = [...newProd.specifications]; updated[gIdx].features = updated[gIdx].features.filter((_, i) => i !== fIdx); setNewProd({ ...newProd, specifications: updated }); };

  const addVariant = () => setNewProd({ ...newProd, variants: [...newProd.variants, { name: '', options: '' }] });
  const removeVariant = (idx: number) => setNewProd({ ...newProd, variants: newProd.variants.filter((_, i) => i !== idx) });
  const addGalleryImage = () => setNewProd({ ...newProd, image_gallery: [...newProd.image_gallery, ''] });
  const removeGalleryImage = (idx: number) => setNewProd({ ...newProd, image_gallery: newProd.image_gallery.filter((_, i) => i !== idx) });

  if (loading) return <div className="p-20 text-center font-bold text-slate-500">Loading Enterprise Console...</div>;
  if (error) return <div className="p-20 text-center font-bold text-rose-600">{error}</div>;

  return (
    <div className="flex flex-col md:flex-row flex-1 w-full bg-slate-50 font-sans h-full min-h-[75vh]">
      
      <aside className="w-full md:w-64 bg-[#081621] text-slate-300 flex flex-col shrink-0">
        <div className="p-4 md:p-6 border-b border-slate-800 hidden md:block">
          <h2 className="text-xl font-black text-white">Aura Console</h2>
          <span className="text-[10px] text-[#3749bb] font-bold uppercase tracking-widest">Enterprise Admin</span>
        </div>
        
        <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible p-2 md:p-4 gap-2 md:gap-0 md:space-y-2 no-scrollbar border-b md:border-b-0 border-slate-800">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Analytics' },
            { id: 'orders', icon: ShoppingCart, label: 'Orders' },
            { id: 'catalog', icon: Package, label: 'Catalog' },
            { id: 'crm', icon: Users, label: 'CRM' },
            { id: 'marketing', icon: Tag, label: 'Marketing' },
            { id: 'cms', icon: ImageIcon, label: 'CMS' },
          ].map(item => (
            <button 
              key={item.id} onClick={() => setActiveTab(item.id as any)} 
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-xl text-sm font-semibold transition ${activeTab === item.id ? 'bg-[#3749bb] text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <item.icon className="w-4 h-4 md:w-5 md:h-5" /> <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 capitalize">{activeTab.replace('-', ' ')}</h1>
          
          {activeTab === 'catalog' && (
            <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
              {/* BULK DELETE BUTTON (Only shows when items are selected) */}
              {selectedProductIds.length > 0 && (
                <button onClick={handleBulkDelete} className="flex-1 sm:flex-none justify-center bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 whitespace-nowrap transition">
                  <Trash2 className="w-4 h-4"/> Delete ({selectedProductIds.length})
                </button>
              )}
              <button onClick={() => setShowCsvModal(true)} className="flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 whitespace-nowrap">
                <Upload className="w-4 h-4"/> Bulk CSV
              </button>
              <button onClick={() => { 
                  setEditingProductId(null); 
                  setProductFormTab('vital'); 
                  setNewProd({name: '', category: '', brand: '', product_code: '', description: '', whats_in_box: '', cash_discount_price: '0', regular_price: '0', stock: 10, image_url: '', image_gallery: [], variants: [], key_features_text: '', specifications: defaultSpecs}); 
                  setShowAddModal(true); 
                }} 
                className="flex-1 sm:flex-none justify-center bg-[#ef4a23] hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 whitespace-nowrap">
                <Plus className="w-4 h-4"/> Add Product
              </button>
            </div>
          )}
          
          {activeTab === 'crm' && (
            <button onClick={() => setShowAddAdminModal(true)} className="bg-[#3749bb] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md flex items-center gap-2">
              <Shield className="w-4 h-4"/> Add Admin User
            </button>
          )}
        </header>

        {/* 1. ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border"><h3 className="text-2xl md:text-3xl font-black text-slate-900">৳{data?.metrics.total_revenue.toLocaleString()}</h3><p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase mt-1">Total Revenue</p></div>
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border"><h3 className="text-2xl md:text-3xl font-black text-slate-900">{data?.metrics.total_orders}</h3><p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase mt-1">Total Orders</p></div>
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border"><h3 className="text-2xl md:text-3xl font-black text-slate-900">{data?.metrics.total_products}</h3><p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase mt-1">Active Products</p></div>
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border"><h3 className="text-2xl md:text-3xl font-black text-slate-900">{data?.metrics.average_rating}</h3><p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase mt-1">Avg Store Rating</p></div>
          </div>
        )}

        {/* 2. ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr><th className="p-4">Order & Date</th><th className="p-4">Customer</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="p-4"><strong className="text-slate-900 block">#{order.id}</strong><span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</span></td>
                    <td className="p-4">{order.customer_name}<br/><span className="text-xs text-slate-500">{order.phone}</span></td>
                    <td className="p-4 font-bold text-[#3749bb]">৳{Number(order.total_amount).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold ${order.status === 'COMPLETED' || order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {order.status === 'PENDING' && <button onClick={() => handleUpdateOrderStatus(order.id, 'PROCESSING')} className="text-xs bg-indigo-50 text-[#3749bb] px-3 py-1.5 rounded-lg font-bold">Process</button>}
                      {order.status === 'PROCESSING' && (
                        <div className="flex flex-col md:flex-row gap-2">
                          <input id={`track-${order.id}`} type="text" placeholder="Tracking #" className="border rounded px-2 py-1 text-xs w-full md:w-24" />
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'SHIPPED', (document.getElementById(`track-${order.id}`) as HTMLInputElement)?.value, 'Standard')} className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-bold"><Truck className="w-3 h-3 inline md:hidden lg:inline"/> Ship</button>
                        </div>
                      )}
                      {order.status === 'SHIPPED' && <button onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED')} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold">Mark Delivered</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. CATALOG */}
        {activeTab === 'catalog' && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th className="p-4 w-12">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={products.length > 0 && selectedProductIds.length === products.length} 
                      className="accent-[#3749bb] w-4 h-4 rounded cursor-pointer" 
                    />
                  </th>
                  <th className="p-4">Product</th>
                  <th className="p-4">Category & Brand</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Price</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        checked={selectedProductIds.includes(p.id)} 
                        onChange={() => handleSelectOne(p.id)} 
                        className="accent-[#3749bb] w-4 h-4 rounded cursor-pointer" 
                      />
                    </td>
                    <td className="p-4 flex items-center gap-3"><img src={p.image_display_url || p.image_url} className="w-10 h-10 object-contain border rounded p-1 bg-white hidden sm:block" /><span className="font-bold text-slate-900 line-clamp-2">{p.name}</span></td>
                    <td className="p-4">{p.category_name}<br/><span className="text-xs text-slate-500">{p.brand}</span></td>
                    <td className="p-4 font-bold text-emerald-600">{p.stock} units</td>
                    <td className="p-4 font-black text-[#ef4a23]">৳{Number(p.cash_discount_price).toLocaleString()}</td>
                    <td className="p-4 text-right space-x-2 md:space-x-3 whitespace-nowrap">
                      <button onClick={() => handleOpenEditModal(p)} className="text-[#3749bb] font-bold hover:bg-indigo-50 p-1.5 rounded transition"><Edit2 className="w-4 h-4 inline"/></button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-600 font-bold hover:bg-rose-50 p-1.5 rounded transition"><Trash2 className="w-4 h-4 inline"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. CRM */}
        {activeTab === 'crm' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[500px]">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr><th className="p-4">Name & Username</th><th className="p-4">Contact Details</th><th className="p-4">Role</th><th className="p-4 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-4"><strong className="text-slate-900 block">{u.name}</strong><span className="text-xs text-slate-500">@{u.username}</span></td>
                    <td className="p-4">{u.email}<br/><span className="text-xs text-slate-500">{u.phone || 'No phone linked'}</span></td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-bold ${u.is_staff ? 'bg-indigo-100 text-[#3749bb]' : 'bg-slate-100 text-slate-700'}`}>{u.is_staff ? 'Admin' : 'Customer'}</span></td>
                    <td className="p-4 text-right">{!u.is_superuser && <button onClick={() => deleteUserAccount(u.id).then(loadAdminData)} className="text-rose-600 font-bold hover:underline">Ban</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. MARKETING */}
        {activeTab === 'marketing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-[#3749bb]"/> Discount Engine</h3>
              <form onSubmit={handleCreateDiscount} className="flex flex-col sm:flex-row gap-3 mb-6">
                <input name="code" type="text" placeholder="CODE" required className="border p-2 rounded-lg text-sm w-full sm:w-1/3 uppercase" />
                <input name="percent" type="number" placeholder="% Off" required className="border p-2 rounded-lg text-sm w-full sm:w-1/4" />
                <input name="limit" type="number" placeholder="Usage Limit" className="border p-2 rounded-lg text-sm w-full sm:w-1/4" />
                <button type="submit" className="bg-[#3749bb] text-white font-bold rounded-lg px-4 py-2 text-sm w-full sm:w-auto">Add</button>
              </form>
              <ul className="space-y-3">
                {discounts.map(d => (
                  <li key={d.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                    <div><strong className="text-slate-900 md:text-lg">{d.code}</strong><span className="text-xs text-slate-500 ml-2">{d.discount_percent}% OFF</span></div>
                    <span className="text-[10px] md:text-xs font-bold text-slate-400">Used: {d.times_used} / {d.usage_limit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-600"/> Review Moderation</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {reviews.map(r => (
                  <div key={r.id} className={`p-4 border rounded-xl ${r.is_approved ? 'bg-white' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex justify-between mb-2"><strong>{r.user_name}</strong> <span className="text-amber-500 font-bold">{r.rating}/5</span></div>
                    <p className="text-sm text-slate-600 mb-3 break-words">"{r.comment}"</p>
                    <div className="flex gap-2">
                      {!r.is_approved && <button onClick={() => handleModerateReview(r.id, true)} className="text-xs bg-emerald-500 text-white px-3 py-1 rounded font-bold">Approve</button>}
                      <button onClick={() => api.delete(`/reviews/${r.id}/`).then(loadAdminData)} className="text-xs bg-rose-100 text-rose-600 px-3 py-1 rounded font-bold">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. CMS */}
        {activeTab === 'cms' && (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#3749bb]"/> Homepage Banners</h3>
            <form onSubmit={handleCreateBanner} className="flex flex-col md:flex-row gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <input name="title" type="text" placeholder="Banner Title" required className="border p-2.5 rounded-lg text-sm flex-1 md:w-1/4" />
              <input name="image" type="url" placeholder="Image URL (https://...)" required className="border p-2.5 rounded-lg text-sm flex-1 md:w-1/2" />
              <button type="submit" className="bg-[#3749bb] text-white font-bold rounded-lg px-4 py-2.5 text-sm w-full md:w-auto shadow-sm">Publish</button>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {banners.map(b => (
                <div key={b.id} className="border rounded-xl overflow-hidden relative group">
                  <button onClick={() => api.delete(`/banners/${b.id}/`).then(loadAdminData)} className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4"/></button>
                  <img src={b.image_url} className="w-full h-24 md:h-32 object-cover bg-slate-100" />
                  <div className="p-3 bg-white font-bold text-sm text-slate-900 line-clamp-1">{b.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* CSV UPLOAD MODAL */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCsvUploadSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-xl font-extrabold text-slate-900">Bulk Import via CSV</h3>
              <button type="button" onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-xs text-slate-500">Upload a Standard CSV or an Amazon Export CSV. Supported Amazon columns include: <code className="bg-slate-100 p-1 rounded font-mono text-[10px]">title, brand, final_price, categories, image_url, description, features, variations</code>.</p>
            <input type="file" accept=".csv" required onChange={e => setCsvFile(e.target.files?.[0] || null)} className="w-full border border-dashed border-slate-300 p-4 rounded-xl text-sm" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCsvModal(false)} className="px-4 py-2 border rounded-xl text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md">Upload & Import</button>
            </div>
          </form>
        </div>
      )}

      {/* ADD ADMIN MODAL */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={async (e) => { e.preventDefault(); try { await createAdminUser(newAdmin); setShowAddAdminModal(false); loadAdminData(); alert('Admin created!'); } catch { alert('Error creating admin'); } }} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><Shield className="w-5 h-5 text-[#3749bb]"/> Add Admin Staff</h3>
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <input type="text" required placeholder="Full Name" className="w-full border p-2.5 rounded-xl text-sm" onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} />
            <input type="tel" required placeholder="Phone Number" className="w-full border p-2.5 rounded-xl text-sm" onChange={e => setNewAdmin({...newAdmin, phone: e.target.value})} />
            <input type="email" required placeholder="Email Address" className="w-full border p-2.5 rounded-xl text-sm" onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} />
            <input type="password" required placeholder="Password" className="w-full border p-2.5 rounded-xl text-sm" onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} />
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="px-4 py-2 border rounded-xl text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-[#3749bb] hover:bg-indigo-900 text-white rounded-xl text-sm font-bold shadow-md">Create Admin</button>
            </div>
          </form>
        </div>
      )}

      {/* AMAZON-STYLE ADD/EDIT PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <form onSubmit={handleProductSubmit} className="bg-white rounded-2xl w-full max-w-4xl my-4 sm:my-8 shadow-2xl border flex flex-col max-h-[95vh] overflow-hidden">
            
            {/* Modal Header & Tabs */}
            <div className="bg-slate-50 border-b px-4 sm:px-6 py-4 flex justify-between items-center z-10 rounded-t-2xl">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">{editingProductId !== null ? 'Edit Product Catalog' : 'Create New Product'}</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 p-1.5 rounded-full transition"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex border-b overflow-x-auto no-scrollbar px-2 bg-white shrink-0">
              {[
                { id: 'vital', icon: Info, label: 'Vital Info' },
                { id: 'offer', icon: Tag, label: 'Offer & Pricing' },
                { id: 'variants', icon: Layers, label: 'Variations' },
                { id: 'images', icon: ImagePlus, label: 'Images' },
                { id: 'description', icon: ListTree, label: 'Description & Specs' }
              ].map(tab => (
                <button key={tab.id} type="button" onClick={() => setProductFormTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${productFormTab === tab.id ? 'border-[#3749bb] text-[#3749bb] bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  <tab.icon className="w-4 h-4"/> {tab.label}
                </button>
              ))}
            </div>

            {/* Form Content */}
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-6 w-full">
              
              {/* TAB 1: VITAL INFO */}
              {productFormTab === 'vital' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                  <div><label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Title</label><input type="text" placeholder="Full product name" required className="w-full border p-3 rounded-xl text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-700 uppercase">Category</label><button type="button" onClick={() => setShowCatInput(!showCatInput)} className="text-[10px] text-[#3749bb] font-bold hover:underline">+ New</button></div>
                      {showCatInput ? (<div className="flex gap-2"><input type="text" placeholder="Name" className="border p-2.5 rounded-xl text-sm flex-1 outline-none focus:border-[#3749bb]" value={newCatName} onChange={e => setNewCatName(e.target.value)} /><button type="button" onClick={handleInlineCreateCategory} className="bg-[#3749bb] text-white px-3 py-2.5 rounded-xl text-xs font-bold">Save</button></div>) : (<select required className="w-full border p-3 rounded-xl text-sm bg-white focus:border-[#3749bb] outline-none" value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value})}><option value="">Select Category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-700 uppercase">Brand Name</label><button type="button" onClick={() => setShowBrandInput(!showBrandInput)} className="text-[10px] text-[#3749bb] font-bold hover:underline">{showBrandInput && existingBrands.length > 0 ? 'Select Existing' : '+ New'}</button></div>
                      {showBrandInput || existingBrands.length === 0 ? ( <input type="text" placeholder="e.g. AOC, MSI" required className="w-full border p-3 rounded-xl text-sm focus:border-[#3749bb] outline-none" value={newProd.brand} onChange={e => setNewProd({...newProd, brand: e.target.value})} /> ) : ( <select required className="w-full border p-3 rounded-xl text-sm bg-white focus:border-[#3749bb] outline-none" value={newProd.brand} onChange={e => setNewProd({...newProd, brand: e.target.value})}><option value="">Select Brand</option>{existingBrands.map((b, i) => <option key={i} value={b}>{b}</option>)}</select>)}
                    </div>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Code (SKU)</label><input type="text" placeholder="e.g. 50472" className="w-full border p-3 rounded-xl text-sm outline-none focus:border-[#3749bb]" value={newProd.product_code} onChange={e => setNewProd({...newProd, product_code: e.target.value})} /></div>
                </div>
              )}

              {/* TAB 2: OFFER & PRICING */}
              {productFormTab === 'offer' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-2">
                  <div><label className="block text-xs font-bold text-slate-700 uppercase mb-1">Discount Price (৳)</label><input type="number" step="0.01" required className="w-full border p-3 rounded-xl text-sm outline-none focus:border-[#3749bb]" value={newProd.cash_discount_price} onChange={e => setNewProd({...newProd, cash_discount_price: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-slate-700 uppercase mb-1">Regular Price (৳)</label><input type="number" step="0.01" className="w-full border p-3 rounded-xl text-sm outline-none focus:border-[#3749bb]" value={newProd.regular_price} onChange={e => setNewProd({...newProd, regular_price: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Stock</label><input type="number" required className="w-full border p-3 rounded-xl text-sm outline-none focus:border-[#3749bb]" value={newProd.stock} onChange={e => setNewProd({...newProd, stock: Number(e.target.value)})} /></div>
                </div>
              )}

              {/* TAB 3: VARIATIONS */}
              {productFormTab === 'variants' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                    <div><h4 className="font-bold text-indigo-900 text-sm">Product Variations</h4><p className="text-xs text-indigo-700 hidden sm:block">Does this product have multiple sizes, colors, or capacities?</p></div>
                    <button type="button" onClick={addVariant} className="bg-[#3749bb] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm whitespace-nowrap">+ Add Type</button>
                  </div>
                  {newProd.variants.map((variant, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-center bg-white p-3 border rounded-xl shadow-sm">
                      <input type="text" placeholder="Type (e.g. Color, Size)" className="w-full sm:w-1/3 border p-2.5 rounded-lg text-sm outline-none focus:border-[#3749bb]" value={variant.name} onChange={e => { const updated = [...newProd.variants]; updated[idx].name = e.target.value; setNewProd({...newProd, variants: updated}); }} />
                      <input type="text" placeholder="Values separated by comma (e.g. Red, Blue, Black)" className="w-full flex-1 border p-2.5 rounded-lg text-sm outline-none focus:border-[#3749bb]" value={variant.options} onChange={e => { const updated = [...newProd.variants]; updated[idx].options = e.target.value; setNewProd({...newProd, variants: updated}); }} />
                      <button type="button" onClick={() => removeVariant(idx)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  ))}
                  {newProd.variants.length === 0 && <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed rounded-xl">No variations added.</div>}
                </div>
              )}

              {/* TAB 4: IMAGES */}
              {productFormTab === 'images' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-4 border-2 border-indigo-100 bg-indigo-50/30 rounded-xl">
                    <label className="block text-xs font-bold text-indigo-900 uppercase mb-2">Main Thumbnail URL (Required)</label>
                    <input type="url" placeholder="https://..." required className="w-full border p-3 rounded-xl text-sm outline-none focus:border-[#3749bb] bg-white" value={newProd.image_url} onChange={e => setNewProd({...newProd, image_url: e.target.value})} />
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs font-bold text-slate-700 uppercase">Additional Gallery Images</label>
                      <button type="button" onClick={addGalleryImage} className="text-xs font-bold text-[#3749bb] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition">+ Add Image</button>
                    </div>
                    <div className="space-y-3">
                      {newProd.image_gallery.map((url, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input type="url" placeholder={`Gallery Image URL ${idx + 1}`} className="flex-1 border p-2.5 rounded-lg text-sm outline-none focus:border-[#3749bb]" value={url} onChange={e => { const updated = [...newProd.image_gallery]; updated[idx] = e.target.value; setNewProd({...newProd, image_gallery: updated}); }} />
                          <button type="button" onClick={() => removeGalleryImage(idx)} className="text-slate-400 hover:text-rose-500 p-2 border rounded-lg bg-slate-50"><X className="w-4 h-4"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: DESCRIPTION & SPECS */}
              {productFormTab === 'description' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 w-full overflow-hidden">
                  
                  <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl">
                    <label className="block text-xs font-bold text-indigo-900 uppercase mb-1 flex items-center gap-1"><Box className="w-3.5 h-3.5"/> What is in the box?</label>
                    <p className="text-[10px] text-indigo-700 mb-2">List items separated by new lines. This will format into the Amazon-style "What is in the box?" section.</p>
                    <textarea rows={3} placeholder="Charger&#10;Cable&#10;User Guide" className="w-full border border-indigo-200 p-3 rounded-lg text-sm font-mono bg-white outline-none focus:border-[#3749bb]" value={newProd.whats_in_box} onChange={e => setNewProd({...newProd, whats_in_box: e.target.value})} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Key Features (Bullet Points - One per line)</label>
                    <textarea rows={4} placeholder="Resolution: FHD (1920 x 1080)&#10;Display: FAST IPS, 420Hz" className="w-full border p-3 rounded-xl text-sm font-mono bg-slate-50 outline-none focus:border-[#3749bb]" value={newProd.key_features_text} onChange={e => setNewProd({...newProd, key_features_text: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rich Description (HTML/Text)</label>
                    <textarea rows={5} placeholder="Detailed product overview..." required className="w-full border p-3 rounded-xl text-sm outline-none focus:border-[#3749bb]" value={newProd.description} onChange={e => setNewProd({...newProd, description: e.target.value})} />
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg border border-slate-200">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest">Detailed Specifications Builder</label>
                      <button type="button" onClick={addSpecGroup} className="text-[11px] font-bold text-[#3749bb] bg-white px-2 py-1 rounded shadow-sm hover:bg-indigo-50">+ Add Group</button>
                    </div>
                    {newProd.specifications.map((group, gIdx) => (
                      <div key={gIdx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-sm w-full overflow-hidden">
                        <div className="flex items-center gap-2">
                          <input type="text" className="flex-1 border-b-2 border-slate-200 p-1.5 text-sm font-black text-indigo-900 bg-transparent outline-none focus:border-[#3749bb] transition w-full" value={group.groupName} onChange={e => { const updated = [...newProd.specifications]; updated[gIdx].groupName = e.target.value; setNewProd({...newProd, specifications: updated}); }} placeholder="Group (e.g. Additional details)" />
                          <button type="button" onClick={() => removeSpecGroup(gIdx)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        <div className="space-y-2 pl-1 sm:pl-4 mt-2 border-l-2 border-slate-100">
                          {group.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex flex-col sm:flex-row items-center gap-2">
                              <input type="text" placeholder="Key (e.g. OS)" className="w-full sm:w-1/3 border p-2 rounded-lg text-xs bg-slate-50 outline-none focus:border-[#3749bb]" value={feat.key} onChange={e => { const updated = [...newProd.specifications]; updated[gIdx].features[fIdx].key = e.target.value; setNewProd({...newProd, specifications: updated}); }} />
                              <input type="text" placeholder="Value" className="w-full flex-1 border p-2 rounded-lg text-xs bg-slate-50 outline-none focus:border-[#3749bb]" value={feat.value} onChange={e => { const updated = [...newProd.specifications]; updated[gIdx].features[fIdx].value = e.target.value; setNewProd({...newProd, specifications: updated}); }} />
                              <button type="button" onClick={() => removeSpecFeature(gIdx, fIdx)} className="text-slate-400 hover:text-rose-600 p-1 sm:p-2 bg-white rounded shadow-sm border"><X className="w-3 h-3"/></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addSpecFeature(gIdx)} className="text-[10px] font-bold text-slate-500 hover:text-[#3749bb] uppercase tracking-widest pt-2 flex items-center gap-1"><Plus className="w-3 h-3"/> Add Row</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t px-4 sm:px-6 py-4 flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 border rounded-xl text-sm font-semibold hover:bg-slate-100 bg-white">Cancel</button>
              <button type="submit" className="px-8 py-2.5 bg-[#ef4a23] hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-md transition">
                {editingProductId !== null ? 'Save Changes' : 'Publish Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};