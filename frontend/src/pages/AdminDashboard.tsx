import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Tag, Image as ImageIcon, 
  Plus, Trash2, Edit2, Shield, CheckCircle, Truck, X, Upload, Download, Layers, Info, ListTree, ImagePlus, Box
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

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productFormTab, setProductFormTab] = useState<'vital' | 'offer' | 'variants' | 'images' | 'description'>('vital');
  
  const [bannerUploadType, setBannerUploadType] = useState<'url' | 'file'>('url');
  
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
      } catch { alert('Failed to execute bulk deletion.'); }
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

  const handleDownloadCSV = () => {
    if (products.length === 0) return alert('No products available to download.');
    
    const headers = ['id', 'name', 'brand', 'product_code', 'category', 'regular_price', 'discount_price', 'stock', 'description', 'image_url', 'images', 'features', 'variants', 'specifications'];
    const csvRows = [headers.join(',')];

    products.forEach(p => {
      const row = [
        p.id,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.brand || '').replace(/"/g, '""')}"`,
        `"${(p.product_code || '').replace(/"/g, '""')}"`,
        `"${(p.category_name || '').replace(/"/g, '""')}"`,
        p.regular_price || 0,
        p.cash_discount_price || 0,
        p.stock || 0,
        `"${(p.description || '').replace(/"/g, '""')}"`,
        `"${(p.image_url || '').replace(/"/g, '""')}"`,
        `"${JSON.stringify(p.image_gallery || []).replace(/"/g, '""')}"`,
        `"${JSON.stringify(p.key_features || []).replace(/"/g, '""')}"`,
        `"${JSON.stringify(p.variants || []).replace(/"/g, '""')}"`,
        `"${JSON.stringify(p.specifications || []).replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auratech_catalog_export.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
    e.preventDefault(); 
    const fd = new FormData(e.currentTarget);
    const payload = new FormData();
    
    payload.append('title', fd.get('title') as string);
    if (fd.get('link')) payload.append('link', fd.get('link') as string);
    
    if (bannerUploadType === 'url') {
      payload.append('image_url', fd.get('image_url') as string);
    } else {
      const file = fd.get('image_file') as File;
      if (file && file.size > 0) payload.append('image', file);
    }

    try { 
      await api.post('/banners/', payload, { headers: { 'Content-Type': 'multipart/form-data' } }); 
      loadAdminData(); 
      (e.target as HTMLFormElement).reset(); 
    } catch { alert('Failed to publish banner'); }
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
      
      <aside className="w-full md:w-64 bg-slate-950 text-slate-400 flex flex-col shrink-0 border-r border-slate-900">
        <div className="p-4 md:p-6 border-b border-slate-900 hidden md:block">
          <h2 className="text-xl font-black text-white tracking-tight">Aura Console</h2>
          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Enterprise Admin</span>
        </div>
        
        <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible p-2 md:p-4 gap-2 md:gap-2 no-scrollbar border-b md:border-b-0 border-slate-900">
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
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-900 hover:text-white'}`}
            >
              <item.icon className="w-4 h-4 md:w-5 md:h-5" /> <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h1>
          
          {activeTab === 'catalog' && (
            <div className="flex flex-wrap gap-2 md:gap-3 w-full xl:w-auto">
              {selectedProductIds.length > 0 && (
                <button onClick={handleBulkDelete} className="flex-1 sm:flex-none justify-center bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 whitespace-nowrap transition">
                  <Trash2 className="w-4 h-4"/> Delete ({selectedProductIds.length})
                </button>
              )}
              <button onClick={handleDownloadCSV} className="flex-1 sm:flex-none justify-center bg-white border border-slate-200 hover:border-slate-300 text-slate-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 whitespace-nowrap transition">
                <Download className="w-4 h-4"/> Export CSV
              </button>
              <button onClick={() => setShowCsvModal(true)} className="flex-1 sm:flex-none justify-center bg-white border border-slate-200 hover:border-slate-300 text-slate-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 whitespace-nowrap transition">
                <Upload className="w-4 h-4"/> Import CSV
              </button>
              <button onClick={() => { 
                  setEditingProductId(null); setProductFormTab('vital'); 
                  setNewProd({name: '', category: '', brand: '', product_code: '', description: '', whats_in_box: '', cash_discount_price: '0', regular_price: '0', stock: 10, image_url: '', image_gallery: [], variants: [], key_features_text: '', specifications: defaultSpecs}); 
                  setShowAddModal(true); 
                }} 
                className="flex-1 sm:flex-none justify-center bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 whitespace-nowrap transition">
                <Plus className="w-4 h-4"/> Add Product
              </button>
            </div>
          )}
          
          {activeTab === 'crm' && (
            <button onClick={() => setShowAddAdminModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 transition">
              <Shield className="w-4 h-4"/> Add Staff
            </button>
          )}
        </header>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"><h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">৳{data?.metrics.total_revenue.toLocaleString()}</h3><p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">Total Revenue</p></div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"><h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{data?.metrics.total_orders}</h3><p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">Total Orders</p></div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"><h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{data?.metrics.total_products}</h3><p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">Active Products</p></div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"><h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{data?.metrics.average_rating}</h3><p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">Avg Store Rating</p></div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr><th className="p-5 font-bold uppercase tracking-wider text-[10px]">Order & Date</th><th className="p-5 font-bold uppercase tracking-wider text-[10px]">Customer</th><th className="p-5 font-bold uppercase tracking-wider text-[10px]">Total</th><th className="p-5 font-bold uppercase tracking-wider text-[10px]">Status</th><th className="p-5 font-bold uppercase tracking-wider text-[10px] text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-5"><strong className="text-slate-900 block tracking-tight">#{order.id}</strong><span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</span></td>
                    <td className="p-5 font-medium text-slate-700">{order.customer_name}<br/><span className="text-xs text-slate-400">{order.phone}</span></td>
                    <td className="p-5 font-black text-slate-900 tracking-tight">৳{Number(order.total_amount).toLocaleString()}</td>
                    <td className="p-5">
                      <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${order.status === 'COMPLETED' || order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' : order.status === 'CANCELLED' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      {order.status === 'PENDING' && <button onClick={() => handleUpdateOrderStatus(order.id, 'PROCESSING')} className="text-xs bg-slate-900 text-white px-4 py-2 rounded-full font-bold shadow-sm hover:bg-slate-800 transition">Process</button>}
                      {order.status === 'PROCESSING' && (
                        <div className="flex flex-col md:flex-row gap-2 justify-end">
                          <input id={`track-${order.id}`} type="text" placeholder="Tracking #" className="border border-slate-200 rounded-full px-3 py-1.5 text-xs w-full md:w-28 focus:outline-none focus:border-slate-900" />
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'SHIPPED', (document.getElementById(`track-${order.id}`) as HTMLInputElement)?.value, 'Standard')} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-full font-bold shadow-sm hover:bg-indigo-700 transition"><Truck className="w-3 h-3 inline md:hidden lg:inline mr-1"/> Ship</button>
                        </div>
                      )}
                      {order.status === 'SHIPPED' && <button onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED')} className="text-xs bg-emerald-500 text-white px-4 py-2 rounded-full font-bold shadow-sm hover:bg-emerald-600 transition">Mark Delivered</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="p-5 w-12"><input type="checkbox" onChange={handleSelectAll} checked={products.length > 0 && selectedProductIds.length === products.length} className="accent-slate-900 w-4 h-4 rounded cursor-pointer" /></th>
                  <th className="p-5 font-bold uppercase tracking-wider text-[10px]">Product</th>
                  <th className="p-5 font-bold uppercase tracking-wider text-[10px]">Category & Brand</th>
                  <th className="p-5 font-bold uppercase tracking-wider text-[10px]">Stock</th>
                  <th className="p-5 font-bold uppercase tracking-wider text-[10px]">Price</th>
                  <th className="p-5 font-bold uppercase tracking-wider text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-5"><input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => handleSelectOne(p.id)} className="accent-slate-900 w-4 h-4 rounded cursor-pointer" /></td>
                    <td className="p-5 flex items-center gap-4"><img src={p.image_display_url || p.image_url} className="w-12 h-12 object-contain border border-slate-100 rounded-xl p-1 bg-white hidden sm:block" /><span className="font-bold text-slate-900 line-clamp-2">{p.name}</span></td>
                    <td className="p-5 font-medium text-slate-700">{p.category_name}<br/><span className="text-xs text-slate-400">{p.brand}</span></td>
                    <td className="p-5 font-bold text-emerald-600">{p.stock} units</td>
                    <td className="p-5 font-black text-slate-900 tracking-tight">৳{Number(p.cash_discount_price).toLocaleString()}</td>
                    <td className="p-5 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => handleOpenEditModal(p)} className="text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-200 p-2 rounded-xl transition"><Edit2 className="w-4 h-4 inline"/></button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="text-slate-400 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 p-2 rounded-xl transition"><Trash2 className="w-4 h-4 inline"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'crm' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[500px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr><th className="p-5 font-bold uppercase tracking-wider text-[10px]">Name & Username</th><th className="p-5 font-bold uppercase tracking-wider text-[10px]">Contact Details</th><th className="p-5 font-bold uppercase tracking-wider text-[10px]">Role</th><th className="p-5 font-bold uppercase tracking-wider text-[10px] text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-5"><strong className="text-slate-900 block">{u.name}</strong><span className="text-xs text-slate-400">@{u.username}</span></td>
                    <td className="p-5 font-medium text-slate-700">{u.email}<br/><span className="text-xs text-slate-400">{u.phone || 'No phone linked'}</span></td>
                    <td className="p-5"><span className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${u.is_staff ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>{u.is_staff ? 'Admin' : 'Customer'}</span></td>
                    <td className="p-5 text-right">{!u.is_superuser && <button onClick={() => deleteUserAccount(u.id).then(loadAdminData)} className="text-rose-600 font-bold hover:underline text-xs">Ban User</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'marketing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2 tracking-tight"><Tag className="w-5 h-5 text-indigo-600"/> Discount Engine</h3>
              <form onSubmit={handleCreateDiscount} className="flex flex-col sm:flex-row gap-3 mb-8">
                <input name="code" type="text" placeholder="CODE" required className="border border-slate-200 bg-slate-50 p-3 rounded-2xl text-sm w-full sm:w-1/3 uppercase focus:outline-none focus:border-slate-900" />
                <input name="percent" type="number" placeholder="% Off" required className="border border-slate-200 bg-slate-50 p-3 rounded-2xl text-sm w-full sm:w-1/4 focus:outline-none focus:border-slate-900" />
                <input name="limit" type="number" placeholder="Limit" className="border border-slate-200 bg-slate-50 p-3 rounded-2xl text-sm w-full sm:w-1/4 focus:outline-none focus:border-slate-900" />
                <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full px-5 py-3 text-sm w-full sm:w-auto shadow-sm transition">Add</button>
              </form>
              <ul className="space-y-3">
                {discounts.map(d => (
                  <li key={d.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-2xl bg-white hover:border-slate-200 transition">
                    <div><strong className="text-slate-900 text-lg tracking-tight">{d.code}</strong><span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md ml-3">{d.discount_percent}% OFF</span></div>
                    <span className="text-xs font-bold text-slate-400">Used: {d.times_used} / {d.usage_limit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2 tracking-tight"><CheckCircle className="w-5 h-5 text-emerald-600"/> Review Moderation</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {reviews.map(r => (
                  <div key={r.id} className={`p-5 border border-slate-100 rounded-2xl transition ${r.is_approved ? 'bg-white' : 'bg-rose-50/50 border-rose-100'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <strong className="text-slate-900 font-bold">{r.user_name}</strong> 
                      <span className="text-indigo-600 font-bold text-sm bg-indigo-50 px-2 py-0.5 rounded-md">{r.rating}/5</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4 break-words leading-relaxed">"{r.comment}"</p>
                    <div className="flex gap-2">
                      {!r.is_approved && <button onClick={() => handleModerateReview(r.id, true)} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-full font-bold shadow-sm transition">Approve</button>}
                      <button onClick={() => api.delete(`/reviews/${r.id}/`).then(loadAdminData)} className="text-xs bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 px-4 py-1.5 rounded-full font-bold transition">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cms' && (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2 tracking-tight"><ImageIcon className="w-5 h-5 text-indigo-600"/> Homepage Banners</h3>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
              <div className="flex gap-4 mb-4 border-b border-slate-200 pb-2">
                <button type="button" onClick={() => setBannerUploadType('url')} className={`text-sm font-bold pb-2 transition ${bannerUploadType === 'url' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Image URL</button>
                <button type="button" onClick={() => setBannerUploadType('file')} className={`text-sm font-bold pb-2 transition ${bannerUploadType === 'file' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Upload File</button>
              </div>
              
              <form onSubmit={handleCreateBanner} className="flex flex-col md:flex-row gap-4">
                <input name="title" type="text" placeholder="Banner Title" required className="border border-slate-200 bg-white p-3 rounded-2xl text-sm flex-1 md:w-1/4 focus:outline-none focus:border-slate-900" />
                
                {bannerUploadType === 'url' ? (
                  <input name="image_url" type="url" placeholder="Image URL (https://...)" required className="border border-slate-200 bg-white p-3 rounded-2xl text-sm flex-1 md:w-1/2 focus:outline-none focus:border-slate-900" />
                ) : (
                  <input name="image_file" type="file" accept="image/*" required className="border border-slate-200 bg-white p-2.5 rounded-2xl text-sm flex-1 md:w-1/2 focus:outline-none focus:border-slate-900 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white" />
                )}

                <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full px-6 py-3 text-sm w-full md:w-auto shadow-sm transition">Publish</button>
              </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              {banners.map(b => (
                <div key={b.id} className="border border-slate-100 rounded-3xl overflow-hidden relative group shadow-sm hover:shadow-md transition">
                  <button onClick={() => api.delete(`/banners/${b.id}/`).then(loadAdminData)} className="absolute top-3 right-3 bg-white/90 backdrop-blur text-rose-600 p-2 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition shadow-sm hover:bg-rose-50"><Trash2 className="w-4 h-4"/></button>
                  <img src={b.image_display_url || b.image_url} className="w-full h-32 md:h-48 object-cover bg-slate-50" />
                  <div className="p-4 bg-white font-bold text-sm text-slate-900 tracking-tight line-clamp-1">{b.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCsvUploadSubmit} className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Bulk Import</h3>
              <button type="button" onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">Upload an Amazon Export CSV. Supported columns: <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded-md font-mono text-[11px]">title, brand, final_price, categories, image_url, description, features, variations</code>.</p>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100 transition text-center">
              <input type="file" accept=".csv" required onChange={e => setCsvFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCsvModal(false)} className="px-5 py-2.5 border border-slate-200 bg-white text-slate-600 rounded-full text-sm font-bold hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-bold shadow-md transition">Upload CSV</button>
            </div>
          </form>
        </div>
      )}

      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={async (e) => { e.preventDefault(); try { await createAdminUser(newAdmin); setShowAddAdminModal(false); loadAdminData(); alert('Admin created!'); } catch { alert('Error creating admin'); } }} className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2"><Shield className="w-6 h-6 text-indigo-600"/> Add Staff</h3>
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5"/></button>
            </div>
            <input type="text" required placeholder="Full Name" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition" onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} />
            <input type="tel" required placeholder="Phone Number" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition" onChange={e => setNewAdmin({...newAdmin, phone: e.target.value})} />
            <input type="email" required placeholder="Email Address" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition" onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} />
            <input type="password" required placeholder="Password" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition" onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} />
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="px-5 py-2.5 border border-slate-200 bg-white text-slate-600 rounded-full text-sm font-bold hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-bold shadow-md transition">Create Admin</button>
            </div>
          </form>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleProductSubmit} className="bg-white rounded-3xl w-full max-w-4xl my-8 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="bg-white border-b border-slate-100 px-6 sm:px-8 py-6 flex justify-between items-center z-10 shrink-0">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingProductId !== null ? 'Edit Catalog Item' : 'New Product'}</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex border-b border-slate-100 overflow-x-auto no-scrollbar px-4 bg-slate-50 shrink-0">
              {[
                { id: 'vital', icon: Info, label: 'Vital Info' },
                { id: 'offer', icon: Tag, label: 'Pricing & Stock' },
                { id: 'variants', icon: Layers, label: 'Variations' },
                { id: 'images', icon: ImagePlus, label: 'Media' },
                { id: 'description', icon: ListTree, label: 'Details' }
              ].map(tab => (
                <button key={tab.id} type="button" onClick={() => setProductFormTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${productFormTab === tab.id ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                  <tab.icon className="w-4 h-4"/> {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-8 w-full">
              
              {productFormTab === 'vital' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Product Title</label><input type="text" placeholder="Full name" required className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category</label><button type="button" onClick={() => setShowCatInput(!showCatInput)} className="text-[10px] text-indigo-600 font-bold hover:underline">+ New</button></div>
                      {showCatInput ? (<div className="flex gap-2"><input type="text" placeholder="Name" className="border border-slate-200 bg-slate-50 p-3 rounded-2xl text-sm flex-1 outline-none focus:border-slate-900 transition" value={newCatName} onChange={e => setNewCatName(e.target.value)} /><button type="button" onClick={handleInlineCreateCategory} className="bg-slate-900 text-white px-4 py-3 rounded-2xl text-xs font-bold">Save</button></div>) : (<select required className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value})}><option value="">Select Category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Brand</label><button type="button" onClick={() => setShowBrandInput(!showBrandInput)} className="text-[10px] text-indigo-600 font-bold hover:underline">{showBrandInput && existingBrands.length > 0 ? 'Select Existing' : '+ New'}</button></div>
                      {showBrandInput || existingBrands.length === 0 ? ( <input type="text" placeholder="e.g. Sony" required className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.brand} onChange={e => setNewProd({...newProd, brand: e.target.value})} /> ) : ( <select required className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.brand} onChange={e => setNewProd({...newProd, brand: e.target.value})}><option value="">Select Brand</option>{existingBrands.map((b, i) => <option key={i} value={b}>{b}</option>)}</select>)}
                    </div>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">SKU / Code</label><input type="text" placeholder="e.g. 50472" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.product_code} onChange={e => setNewProd({...newProd, product_code: e.target.value})} /></div>
                </div>
              )}

              {productFormTab === 'offer' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                  <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Selling Price (৳)</label><input type="number" step="0.01" required className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.cash_discount_price} onChange={e => setNewProd({...newProd, cash_discount_price: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">MSRP Price (৳)</label><input type="number" step="0.01" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.regular_price} onChange={e => setNewProd({...newProd, regular_price: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Inventory Count</label><input type="number" required className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:border-slate-900 focus:bg-white outline-none transition" value={newProd.stock} onChange={e => setNewProd({...newProd, stock: Number(e.target.value)})} /></div>
                </div>
              )}

              {productFormTab === 'variants' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex justify-between items-center">
                    <div><h4 className="font-bold text-slate-900 text-sm">Product Variations</h4><p className="text-xs text-slate-500 hidden sm:block mt-1">Colors, sizes, or capacities</p></div>
                    <button type="button" onClick={addVariant} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-sm whitespace-nowrap transition hover:bg-slate-800">+ Add Type</button>
                  </div>
                  {newProd.variants.map((variant, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 border border-slate-100 rounded-3xl shadow-sm">
                      <input type="text" placeholder="Type (e.g. Color)" className="w-full sm:w-1/3 border border-slate-200 bg-slate-50 p-3 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition" value={variant.name} onChange={e => { const updated = [...newProd.variants]; updated[idx].name = e.target.value; setNewProd({...newProd, variants: updated}); }} />
                      <input type="text" placeholder="Comma separated (Red, Blue)" className="w-full flex-1 border border-slate-200 bg-slate-50 p-3 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition" value={variant.options} onChange={e => { const updated = [...newProd.variants]; updated[idx].options = e.target.value; setNewProd({...newProd, variants: updated}); }} />
                      <button type="button" onClick={() => removeVariant(idx)} className="text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 p-3 rounded-2xl transition"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  ))}
                </div>
              )}

              {productFormTab === 'images' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-6 border border-indigo-100 bg-indigo-50/50 rounded-3xl">
                    <label className="block text-xs font-bold text-indigo-900 uppercase tracking-widest mb-3">Main Thumbnail URL (Required)</label>
                    <input type="url" placeholder="https://..." required className="w-full border border-indigo-200 p-4 rounded-2xl text-sm focus:outline-none focus:border-indigo-600 bg-white transition shadow-sm" value={newProd.image_url} onChange={e => setNewProd({...newProd, image_url: e.target.value})} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Gallery Images</label>
                      <button type="button" onClick={addGalleryImage} className="text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition">+ Add Image</button>
                    </div>
                    <div className="space-y-3">
                      {newProd.image_gallery.map((url, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input type="url" placeholder={`URL ${idx + 1}`} className="flex-1 border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition" value={url} onChange={e => { const updated = [...newProd.image_gallery]; updated[idx] = e.target.value; setNewProd({...newProd, image_gallery: updated}); }} />
                          <button type="button" onClick={() => removeGalleryImage(idx)} className="text-slate-400 hover:text-rose-600 p-3.5 border border-slate-200 rounded-2xl bg-white transition hover:border-rose-200 hover:bg-rose-50"><X className="w-4 h-4"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {productFormTab === 'description' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 w-full overflow-hidden">
                  <div className="bg-slate-50 p-6 border border-slate-100 rounded-3xl">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2"><Box className="w-4 h-4"/> Box Contents</label>
                    <textarea rows={3} placeholder="Charger&#10;Cable" className="w-full border border-slate-200 p-4 rounded-2xl text-sm font-mono bg-white focus:outline-none focus:border-slate-900 transition" value={newProd.whats_in_box} onChange={e => setNewProd({...newProd, whats_in_box: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Key Features (One per line)</label>
                    <textarea rows={4} placeholder="Resolution: FHD..." className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl text-sm font-mono focus:outline-none focus:border-slate-900 focus:bg-white transition" value={newProd.key_features_text} onChange={e => setNewProd({...newProd, key_features_text: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Rich Description (HTML/Text)</label>
                    <textarea rows={5} placeholder="Detailed overview..." required className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition" value={newProd.description} onChange={e => setNewProd({...newProd, description: e.target.value})} />
                  </div>
                  
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-900 uppercase tracking-widest">Specifications Builder (Multi-line values supported)</label>
                      <button type="button" onClick={addSpecGroup} className="text-[11px] font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition">+ Add Group</button>
                    </div>
                    {newProd.specifications.map((group, gIdx) => (
                      <div key={gIdx} className="p-4 bg-white border border-slate-200 rounded-3xl space-y-3 shadow-sm w-full overflow-hidden">
                        <div className="flex items-center gap-3">
                          <input type="text" className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-slate-900 transition w-full" value={group.groupName} onChange={e => { const updated = [...newProd.specifications]; updated[gIdx].groupName = e.target.value; setNewProd({...newProd, specifications: updated}); }} placeholder="Group (e.g. Display)" />
                          <button type="button" onClick={() => removeSpecGroup(gIdx)} className="text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 p-3 rounded-xl transition"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        <div className="space-y-2 mt-2">
                          {group.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex flex-col sm:flex-row items-center gap-2">
                              <input type="text" placeholder="Key" className="w-full sm:w-1/3 border border-slate-200 p-2.5 rounded-xl text-sm bg-white outline-none focus:border-slate-900 transition" value={feat.key} onChange={e => { const updated = [...newProd.specifications]; updated[gIdx].features[fIdx].key = e.target.value; setNewProd({...newProd, specifications: updated}); }} />
                              
                              {/* MULTI-LINE TEXTAREA FOR SPEC VALUES */}
                              <textarea rows={2} placeholder="Value (multi-line)" className="w-full flex-1 border border-slate-200 p-2.5 rounded-xl text-sm bg-white outline-none focus:border-slate-900 transition resize-y" value={feat.value} onChange={e => { const updated = [...newProd.specifications]; updated[gIdx].features[fIdx].value = e.target.value; setNewProd({...newProd, specifications: updated}); }} />

                              <button type="button" onClick={() => removeSpecFeature(gIdx, fIdx)} className="text-slate-400 hover:text-rose-600 p-2.5 bg-slate-50 rounded-xl hover:bg-rose-50 transition"><X className="w-4 h-4"/></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addSpecFeature(gIdx)} className="text-[10px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest pt-2 flex items-center gap-1"><Plus className="w-3 h-3"/> Add Row</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border-t border-slate-100 px-6 sm:px-8 py-5 flex justify-end gap-3 shrink-0 rounded-b-3xl">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 border border-slate-200 rounded-full text-sm font-semibold hover:bg-slate-50 text-slate-600 transition">Cancel</button>
              <button type="submit" className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-bold shadow-md transition">
                {editingProductId !== null ? 'Save Changes' : 'Publish Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};