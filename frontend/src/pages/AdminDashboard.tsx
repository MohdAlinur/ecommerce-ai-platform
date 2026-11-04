import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tag,
  Plus, Trash2, Edit2, Shield, CheckCircle, Truck, X, Upload, Download,
  Layers, Info, ListTree, ImagePlus, Box, AlertTriangle, Search, CreditCard,
  Star, Sparkles, Bot, BookOpen
} from 'lucide-react';
import type { AnalyticsData, Category, Product, UserProfile, OrderData, SupportGuide } from '../types';
import api, {
  fetchAdminAnalytics, fetchCategories, createCategory, createProduct,
  updateProduct, patchProduct, deleteProduct, fetchAllUsers, deleteUserAccount,
  fetchProducts, createAdminUser, bulkImportCSV, bulkDeleteProducts,
  fetchSupportGuides, createSupportGuide, updateSupportGuide, deleteSupportGuide
} from '../api';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'catalog' | 'crm' | 'marketing' | 'support-kb'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [supportGuides, setSupportGuides] = useState<SupportGuide[]>([]);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [orderFilter, setOrderFilter] = useState<string>('ALL');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '', email: '', password: '' });

  // Customer Service FAQ Guide Modal State
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [editingGuideId, setEditingGuideId] = useState<number | null>(null);
  const [guideForm, setGuideForm] = useState({
    title: '',
    keywords: '',
    response_markdown: '',
    is_active: true
  });

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productFormTab, setProductFormTab] = useState<'vital' | 'offer' | 'variants' | 'images' | 'description'>('vital');

  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showBrandInput, setShowBrandInput] = useState(false);
  const existingBrands = Array.from(new Set(products.map(p => p.brand).filter((b): b is string => Boolean(b) && b.trim() !== '')));

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
    cash_discount_price: '0', regular_price: '0', stock: 10, is_featured: false,
    image_url: '', image_gallery: [] as string[],
    variants: [] as { name: string; options: string }[],
    key_features_text: '',
    specifications: defaultSpecs
  });

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, catsRes, usersRes, prodsRes, ordersRes, reviewsRes, discountRes, guidesRes] = await Promise.all([
        fetchAdminAnalytics(),
        fetchCategories(),
        fetchAllUsers(),
        fetchProducts(),
        api.get('/orders/').then(r => r.data),
        api.get('/reviews/').then(r => r.data),
        api.get('/discounts/').then(r => r.data),
        fetchSupportGuides().catch(() => [])
      ]);

      setData(analyticsRes);
      setCategories(catsRes);
      setUsers(usersRes);
      setProducts(prodsRes);
      setOrders(ordersRes);
      setReviews(reviewsRes);
      setDiscounts(discountRes);
      setSupportGuides(guidesRes);
      setError(null);
      window.dispatchEvent(new CustomEvent('catalog-updated'));
    } catch {
      setError('Access Denied: Administrator privileges are required to view this console.');
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
    } catch {
      alert('Failed to create category.');
    }
  };

  const handleToggleFeatured = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !product.is_featured;
    try {
      await patchProduct(product.id, { is_featured: nextState });
      setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, is_featured: nextState } : p)));
      window.dispatchEvent(new CustomEvent('catalog-updated'));
    } catch {
      alert('Failed to update featured status.');
    }
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProductId(p.id);
    const featuresStr = Array.isArray(p.key_features) ? p.key_features.join('\n') : '';
    setNewProd({
      name: p.name || '',
      category: String(p.category || ''),
      brand: p.brand || '',
      product_code: p.product_code || '',
      description: p.description || '',
      whats_in_box: '',
      cash_discount_price: String(p.cash_discount_price || '0'),
      regular_price: String(p.regular_price || '0'),
      stock: p.stock ?? 10,
      is_featured: Boolean(p.is_featured),
      image_url: p.image_url || '',
      image_gallery: p.image_gallery || [],
      variants: p.variants ? p.variants.map((v: any) => ({ name: v.name, options: v.options.join(', ') })) : [],
      key_features_text: featuresStr,
      specifications: Array.isArray(p.specifications) && p.specifications.length > 0 ? (p.specifications as any) : defaultSpecs
    });
    if (p.brand && !existingBrands.includes(p.brand)) setShowBrandInput(true);
    setProductFormTab('vital');
    setShowAddModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Delete this product? If it is the last product in its category, the empty category will also be deleted automatically.')) return;
    try {
      const res = await deleteProduct(id);
      if (res?.category_auto_deleted && res?.deleted_category_name) {
        alert(`Product deleted. Category "${res.deleted_category_name}" had 0 remaining products and was automatically removed.`);
      }
      loadAdminData();
    } catch {
      alert('Failed to delete product.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedProductIds.length} selected products? Any categories left empty will also be automatically deleted.`)) return;
    try {
      const res = await bulkDeleteProducts(selectedProductIds);
      if (res?.deleted_categories?.length > 0) {
        alert(`Deleted products and automatically removed empty categories: ${res.deleted_categories.join(', ')}`);
      }
      setSelectedProductIds([]);
      loadAdminData();
    } catch {
      alert('Failed to execute bulk deletion.');
    }
  };

  const handleQuickStockUpdate = async (productId: number, newStock: number) => {
    if (newStock < 0) return;
    try {
      await patchProduct(productId, { stock: newStock });
      setProducts(prev => prev.map(p => (p.id === productId ? { ...p, stock: newStock } : p)));
    } catch {
      alert('Failed to update stock.');
    }
  };

  const handleDownloadCSV = () => {
    if (products.length === 0) return alert('No products available to export.');
    const headers = ['id', 'name', 'brand', 'product_code', 'category', 'regular_price', 'discount_price', 'stock', 'is_featured', 'description', 'image_url', 'images', 'features', 'variants', 'specifications'];
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
        p.is_featured ? 'True' : 'False',
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
      setShowCsvModal(false);
      setCsvFile(null);
      loadAdminData();
    } catch {
      alert('Failed to import CSV file.');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string, paymentStatus?: string, tracking?: string, courier?: string) => {
    try {
      const payload: Record<string, unknown> = { status };
      if (paymentStatus) payload.payment_status = paymentStatus;
      if (tracking !== undefined) payload.tracking_number = tracking;
      if (courier !== undefined) payload.courier_name = courier;
      await api.patch(`/orders/${orderId}/`, payload);
      loadAdminData();
    } catch {
      alert('Failed to update order status');
    }
  };

  const handleCreateDiscount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/discounts/', {
        code: String(fd.get('code') || '').toUpperCase().trim(),
        discount_percent: Number(fd.get('percent') || 10),
        usage_limit: Number(fd.get('limit') || 100)
      });
      loadAdminData();
      (e.target as HTMLFormElement).reset();
    } catch {
      alert('Failed to create discount code.');
    }
  };

  const handleModerateReview = async (reviewId: number, is_approved: boolean) => {
    try {
      await api.patch(`/reviews/${reviewId}/`, { is_approved });
      loadAdminData();
    } catch {
      alert('Failed to moderate review');
    }
  };

  // ============================================================================
  // CUSTOMER SERVICE FAQ GUIDE HANDLERS
  // ============================================================================
  const handleOpenNewGuideModal = () => {
    setEditingGuideId(null);
    setGuideForm({
      title: '',
      keywords: '',
      response_markdown: '',
      is_active: true
    });
    setShowGuideModal(true);
  };

  const handleOpenEditGuideModal = (guide: SupportGuide) => {
    setEditingGuideId(guide.id);
    setGuideForm({
      title: guide.title,
      keywords: guide.keywords,
      response_markdown: guide.response_markdown,
      is_active: guide.is_active
    });
    setShowGuideModal(true);
  };

  const handleSaveSupportGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideForm.title.trim() || !guideForm.keywords.trim() || !guideForm.response_markdown.trim()) {
      return alert('Please fill in the title, trigger keywords, and step-by-step response.');
    }
    try {
      if (editingGuideId !== null) {
        await updateSupportGuide(editingGuideId, guideForm);
      } else {
        await createSupportGuide(guideForm);
      }
      setShowGuideModal(false);
      const updated = await fetchSupportGuides();
      setSupportGuides(updated);
    } catch {
      alert('Failed to save Customer Service guide.');
    }
  };

  const handleToggleGuideActive = async (guide: SupportGuide) => {
    try {
      const updated = await updateSupportGuide(guide.id, { is_active: !guide.is_active });
      setSupportGuides(prev => prev.map(g => (g.id === guide.id ? updated : g)));
    } catch {
      alert('Failed to toggle guide status.');
    }
  };

  const handleDeleteSupportGuide = async (id: number) => {
    if (!confirm('Delete this Customer Service FAQ guide?')) return;
    try {
      await deleteSupportGuide(id);
      setSupportGuides(prev => prev.filter(g => g.id !== id));
    } catch {
      alert('Failed to delete guide.');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', newProd.name);
    formData.append('category', String(newProd.category));
    formData.append('brand', newProd.brand);
    formData.append('product_code', newProd.product_code);
    formData.append('is_featured', newProd.is_featured ? 'true' : 'false');

    const finalDesc = newProd.whats_in_box
      ? `${newProd.description}\n\n<b>What is in the box?</b>\n<ul><li>${newProd.whats_in_box.replace(/\n/g, '</li><li>')}</li></ul>`
      : newProd.description;
    formData.append('description', finalDesc);
    formData.append('cash_discount_price', newProd.cash_discount_price);
    formData.append('regular_price', newProd.regular_price);
    formData.append('stock', String(newProd.stock));
    formData.append('image_url', newProd.image_url);
    formData.append('key_features', JSON.stringify(newProd.key_features_text.split('\n').filter(f => f.trim() !== '')));
    formData.append('specifications', JSON.stringify(newProd.specifications));
    formData.append('image_gallery', JSON.stringify(newProd.image_gallery.filter(url => url.trim() !== '')));

    const formattedVariants = newProd.variants.filter(v => v.name.trim() !== '').map(v => ({
      name: v.name,
      options: v.options.split(',').map(o => o.trim()).filter(o => o !== '')
    }));
    formData.append('variants', JSON.stringify(formattedVariants));

    try {
      if (editingProductId !== null) await updateProduct(editingProductId, formData);
      else await createProduct(formData);
      setShowAddModal(false);
      loadAdminData();
    } catch {
      alert('Error saving product. Please verify all fields.');
    }
  };

  const addSpecGroup = () => setNewProd({ ...newProd, specifications: [...newProd.specifications, { groupName: 'New Group', features: [{ key: '', value: '' }] }] });
  const removeSpecGroup = (idx: number) => setNewProd({ ...newProd, specifications: newProd.specifications.filter((_, i) => i !== idx) });
  const addSpecFeature = (idx: number) => {
    const updated = [...newProd.specifications];
    updated[idx].features.push({ key: '', value: '' });
    setNewProd({ ...newProd, specifications: updated });
  };
  const removeSpecFeature = (gIdx: number, fIdx: number) => {
    const updated = [...newProd.specifications];
    updated[gIdx].features = updated[gIdx].features.filter((_, i) => i !== fIdx);
    setNewProd({ ...newProd, specifications: updated });
  };

  const addVariant = () => setNewProd({ ...newProd, variants: [...newProd.variants, { name: '', options: '' }] });
  const removeVariant = (idx: number) => setNewProd({ ...newProd, variants: newProd.variants.filter((_, i) => i !== idx) });
  const addGalleryImage = () => setNewProd({ ...newProd, image_gallery: [...newProd.image_gallery, ''] });
  const removeGalleryImage = (idx: number) => setNewProd({ ...newProd, image_gallery: newProd.image_gallery.filter((_, i) => i !== idx) });

  const filteredCatalog = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (p.category_name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (p.product_code || '').toLowerCase().includes(catalogSearch.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedCategoryFilter === 'FEATURED') return Boolean(p.is_featured);
    if (selectedCategoryFilter !== 'ALL') return String(p.category) === selectedCategoryFilter;
    return true;
  });

  const filteredOrders = orders.filter(o => (orderFilter === 'ALL' ? true : o.status === orderFilter));
  const totalZeroTokenHits = supportGuides.reduce((sum, g) => sum + (g.hit_count || 0), 0);

  if (loading) return <div className="p-24 text-center font-bold text-slate-500">Loading Enterprise Admin Console...</div>;
  if (error) return <div className="p-24 text-center font-bold text-rose-600">{error}</div>;

  return (
    <div className="flex flex-col md:flex-row flex-1 w-full bg-slate-50/70 font-sans min-h-[85vh]">
      {/* Minimalist Sidebar */}
      <aside className="w-full md:w-60 bg-slate-950 text-slate-400 flex flex-col shrink-0 border-r border-slate-900">
        <div className="p-6 border-b border-slate-900 hidden md:block">
          <h2 className="text-lg font-black text-white tracking-tight">Aura Console</h2>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Store Management</span>
        </div>

        <nav className="flex flex-row md:flex-col overflow-x-auto p-2 md:p-3.5 gap-1.5 no-scrollbar">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Analytics' },
            { id: 'orders', icon: ShoppingCart, label: `Orders (${orders.length})` },
            { id: 'catalog', icon: Package, label: `Catalog (${products.length})` },
            { id: 'crm', icon: Users, label: `Customers (${users.length})` },
            { id: 'marketing', icon: Tag, label: 'Promos & Reviews' },
            { id: 'support-kb', icon: Bot, label: `AI Support KB (${supportGuides.length})` },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                activeTab === item.id ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-900 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto w-full space-y-6">
        {/* Top Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 capitalize tracking-tight">
              {activeTab === 'support-kb' ? 'AI Customer Service Knowledge Base' : activeTab}
            </h1>
            <p className="text-xs text-slate-500">
              {activeTab === 'support-kb'
                ? 'Manage step-by-step website guides served directly from PostgreSQL using 0 AI tokens'
                : 'Real-time store operations and database management'}
            </p>
          </div>

          {activeTab === 'catalog' && (
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {selectedProductIds.length > 0 && (
                <button onClick={handleBulkDelete} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition shadow-sm">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedProductIds.length})
                </button>
              )}
              <button onClick={handleDownloadCSV} className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition shadow-sm">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button onClick={() => setShowCsvModal(true)} className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition shadow-sm">
                <Upload className="w-3.5 h-3.5" /> Import CSV
              </button>
              <button
                onClick={() => {
                  setEditingProductId(null);
                  setProductFormTab('vital');
                  setNewProd({
                    name: '', category: '', brand: '', product_code: '', description: '', whats_in_box: '',
                    cash_discount_price: '0', regular_price: '0', stock: 10, is_featured: false, image_url: '', image_gallery: [],
                    variants: [], key_features_text: '', specifications: defaultSpecs
                  });
                  setShowAddModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </div>
          )}

          {activeTab === 'crm' && (
            <button onClick={() => setShowAddAdminModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition shadow-sm">
              <Shield className="w-3.5 h-3.5" /> Add Staff Admin
            </button>
          )}

          {activeTab === 'support-kb' && (
            <button onClick={handleOpenNewGuideModal} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Add Support FAQ Guide
            </button>
          )}
        </header>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">৳{data.metrics.total_revenue.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Orders</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{data.metrics.total_orders}</h3>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Pending Orders</span>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{data.metrics.pending_orders ?? 0}</h3>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Products</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{data.metrics.total_products}</h3>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categories</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{categories.length}</h3>
              </div>
              <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 shadow-sm">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Low Stock (&lt;5)</span>
                <h3 className="text-2xl font-black text-rose-600 mt-1 flex items-center gap-1.5">
                  {data.metrics.low_stock_alerts ?? 0} <AlertTriangle className="w-5 h-5" />
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">Last 7 Days Revenue Trend</h3>
                <div className="grid grid-cols-7 gap-2 items-end h-44 pt-6 border-b border-slate-100 pb-2">
                  {data.sales_trend.map((day, idx) => {
                    const maxRev = Math.max(...data.sales_trend.map(d => d.revenue), 1);
                    const heightPct = Math.max(8, Math.round((day.revenue / maxRev) * 100));
                    return (
                      <div key={idx} className="flex flex-col items-center justify-end h-full gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500">৳{day.revenue > 999 ? `${(day.revenue / 1000).toFixed(1)}k` : day.revenue}</span>
                        <div className="w-full max-w-[36px] bg-slate-900 rounded-t-xl transition-all" style={{ height: `${heightPct}%` }}></div>
                        <span className="text-[10px] font-bold text-slate-400">{day.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">Top Selling Products</h3>
                {data.top_selling_products && data.top_selling_products.length > 0 ? (
                  <div className="space-y-3">
                    {data.top_selling_products.map((tp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-2xl bg-slate-50">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 truncate">{tp.name}</p>
                          <p className="text-[10px] text-slate-400">{tp.units_sold} units sold</p>
                        </div>
                        <span className="font-black text-slate-900 shrink-0">৳{tp.revenue.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-8 text-center">No sales recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(st => (
                <button
                  key={st}
                  onClick={() => setOrderFilter(st)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                    orderFilter === st ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4 font-bold">Order / TrxID</th>
                    <th className="p-4 font-bold">Customer & Shipping</th>
                    <th className="p-4 font-bold">Payment & Card / bKash Info</th>
                    <th className="p-4 font-bold">Items & Total</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold text-right">Fulfillment Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition align-top">
                      <td className="p-4">
                        <strong className="text-slate-900 text-sm block">#{order.id}</strong>
                        <span className="font-mono text-[10px] text-slate-500 block">{order.transaction_id}</span>
                        <span className="text-[10px] text-slate-400">{new Date(order.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="p-4">
                        <strong className="text-slate-900 block">{order.customer_name}</strong>
                        <span className="text-slate-500 block">{order.customer_email}</span>
                        <span className="text-slate-700 font-bold block">{order.phone}</span>
                        <span className="text-slate-500 text-[11px] block mt-1 max-w-xs">{order.shipping_address}, {order.city}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase mb-1 ${
                          order.payment_status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {order.payment_status} ({order.payment_method.toUpperCase()})
                        </span>
                        {order.masked_card && (
                          <div className="text-[11px] text-slate-600 mt-1">
                            <CreditCard className="w-3 h-3 inline mr-1" />
                            <strong>{order.masked_card}</strong>
                            <div className="text-[10px] text-slate-400">Holder: {order.card_holder_name} | Exp: {order.card_expiry}</div>
                          </div>
                        )}
                        {order.bkash_trx_id && (
                          <div className="text-[11px] text-slate-600 mt-1">
                            <strong>TrxID: {order.bkash_trx_id}</strong>
                            <div className="text-[10px] text-slate-400">Sender: {order.payment_phone}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <strong className="text-slate-900 text-sm block mb-1">৳{Number(order.total_amount).toLocaleString()}</strong>
                        <div className="space-y-0.5 text-[11px] text-slate-500">
                          {order.items.map(it => (
                            <div key={it.id}>{it.quantity}x {it.product_name}</div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                          order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                          order.status === 'CANCELLED' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-y-2">
                        {order.status === 'PENDING' && (
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'PROCESSING', 'PAID')} className="bg-slate-900 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold hover:bg-slate-800 transition">
                            Verify & Process
                          </button>
                        )}
                        {order.status === 'PROCESSING' && (
                          <div className="flex flex-col gap-1.5 items-end">
                            <input id={`track-${order.id}`} type="text" placeholder="Tracking #" className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs w-32" />
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'SHIPPED', order.payment_status, (document.getElementById(`track-${order.id}`) as HTMLInputElement)?.value, 'Courier')}
                              className="bg-indigo-600 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold hover:bg-indigo-700 transition"
                            >
                              <Truck className="w-3 h-3 inline mr-1" /> Dispatch
                            </button>
                          </div>
                        )}
                        {order.status === 'SHIPPED' && (
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED', 'PAID')} className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold hover:bg-emerald-700 transition">
                            Mark Delivered
                          </button>
                        )}
                        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                          <div>
                            <button onClick={() => handleUpdateOrderStatus(order.id, 'CANCELLED')} className="text-[11px] text-rose-500 font-bold hover:underline">
                              Cancel & Restore Stock
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CATALOG */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span>Showing <strong className="text-slate-900">{filteredCatalog.length}</strong> of {products.length} products</span>
                  <span>•</span>
                  <span className="text-amber-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {products.filter(p => p.is_featured).length} Featured on Homepage
                  </span>
                </div>

                <div className="relative w-full sm:w-80 md:w-96 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by product name, brand, or SKU..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900 transition"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  All Categories ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('FEATURED')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                    selectedCategoryFilter === 'FEATURED'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60'
                  }`}
                >
                  <Star className="w-3 h-3 fill-current" /> Featured ({products.filter(p => p.is_featured).length})
                </button>
                {categories.map(c => {
                  const count = c.product_count ?? products.filter(p => p.category === c.id).length;
                  const active = selectedCategoryFilter === String(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(active ? 'ALL' : String(c.id))}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.name} <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[820px]">
                <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        onChange={e => setSelectedProductIds(e.target.checked ? filteredCatalog.map(p => p.id) : [])}
                        checked={filteredCatalog.length > 0 && selectedProductIds.length === filteredCatalog.length}
                        className="accent-slate-900 w-4 h-4 rounded cursor-pointer"
                      />
                    </th>
                    <th className="p-4 font-bold">Product</th>
                    <th className="p-4 font-bold">Homepage Spotlight</th>
                    <th className="p-4 font-bold">Category & Brand</th>
                    <th className="p-4 font-bold">Quick Stock</th>
                    <th className="p-4 font-bold">Selling Price</th>
                    <th className="p-4 font-bold text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() =>
                            setSelectedProductIds(prev =>
                              prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                            )
                          }
                          className="accent-slate-900 w-4 h-4 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-4 flex items-center gap-3.5 max-w-md">
                        <img src={p.image_display_url || p.image_url} alt={p.name} className="w-11 h-11 object-contain border border-slate-100 rounded-xl p-1 bg-white shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 line-clamp-1 block">{p.name}</span>
                          {p.product_code && <span className="text-[10px] text-slate-400 font-mono">SKU: {p.product_code}</span>}
                        </div>
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={(e) => handleToggleFeatured(p, e)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-wide transition-all ${
                            p.is_featured
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm hover:from-amber-500 hover:to-amber-600'
                              : 'bg-transparent border border-dashed border-slate-300 text-slate-400 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/40'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${p.is_featured ? 'fill-slate-950 text-slate-950' : ''}`} />
                          {p.is_featured ? 'Featured' : '+ Feature'}
                        </button>
                      </td>

                      <td className="p-4 font-medium text-slate-700">
                        {p.category_name}
                        <br />
                        <span className="text-[11px] text-slate-400">{p.brand}</span>
                      </td>
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full px-1.5 py-0.5">
                          <button onClick={() => handleQuickStockUpdate(p.id, p.stock - 1)} className="w-6 h-6 rounded-full font-bold text-slate-600 hover:bg-white transition">-</button>
                          <span className={`font-black px-2 min-w-[2rem] text-center ${p.stock <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>{p.stock}</span>
                          <button onClick={() => handleQuickStockUpdate(p.id, p.stock + 1)} className="w-6 h-6 rounded-full font-bold text-slate-600 hover:bg-white transition">+</button>
                        </div>
                      </td>
                      <td className="p-4 font-black text-slate-900">৳{Number(p.cash_discount_price).toLocaleString()}</td>
                      <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleOpenEditModal(p)} title="Edit Product" className="text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 p-2 rounded-xl transition">
                          <Edit2 className="w-3.5 h-3.5 inline" />
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id)} title="Delete Product" className="text-slate-500 hover:text-rose-600 bg-white border border-slate-200 p-2 rounded-xl transition">
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CRM */}
        {activeTab === 'crm' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 font-bold">Name & Username</th>
                  <th className="p-4 font-bold">Contact & Address</th>
                  <th className="p-4 font-bold">Role</th>
                  <th className="p-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4">
                      <strong className="text-slate-900 block">{u.name}</strong>
                      <span className="text-slate-400">@{u.username}</span>
                    </td>
                    <td className="p-4 font-medium text-slate-700">
                      {u.email}
                      <br />
                      <span className="text-slate-500">{u.phone || 'No phone'}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${u.is_staff ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {u.is_staff ? 'Admin' : 'Customer'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {!u.is_superuser && (
                        <button onClick={() => deleteUserAccount(u.id).then(loadAdminData)} className="text-rose-600 font-bold hover:underline">
                          Remove Account
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: MARKETING */}
        {activeTab === 'marketing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" /> Promo & Discount Codes
              </h3>
              <form onSubmit={handleCreateDiscount} className="flex flex-col sm:flex-row gap-2.5 mb-6">
                <input name="code" type="text" placeholder="CODE (e.g. AURA10)" required className="border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs w-full sm:w-1/3 uppercase font-bold" />
                <input name="percent" type="number" placeholder="% Off" required className="border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs w-full sm:w-1/4" />
                <input name="limit" type="number" placeholder="Max Uses" defaultValue={100} className="border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs w-full sm:w-1/4" />
                <button type="submit" className="bg-slate-900 text-white font-bold rounded-xl px-4 py-2.5 text-xs">Add</button>
              </form>
              <ul className="space-y-2.5">
                {discounts.map(d => (
                  <li key={d.id} className="flex justify-between items-center p-3.5 border border-slate-100 rounded-2xl">
                    <div>
                      <strong className="text-slate-900 text-sm font-mono">{d.code}</strong>
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md ml-2">{d.discount_percent}% OFF</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">Used: {d.times_used}/{d.usage_limit}</span>
                      <button onClick={() => api.delete(`/discounts/${d.id}/`).then(loadAdminData)} className="text-rose-500 hover:text-rose-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Customer Review Moderation
              </h3>
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {reviews.map(r => (
                  <div key={r.id} className={`p-4 border rounded-2xl ${r.is_approved ? 'border-slate-100 bg-white' : 'bg-amber-50/50 border-amber-200'}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <strong className="text-slate-900 text-xs">{r.user_name} <span className="text-slate-400 font-normal">on {r.product_name}</span></strong>
                      <span className="text-indigo-600 font-bold text-xs">{r.rating}/5 ★</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">"{r.comment}"</p>
                    <div className="flex gap-2">
                      {!r.is_approved && (
                        <button onClick={() => handleModerateReview(r.id, true)} className="text-[11px] bg-emerald-600 text-white px-3 py-1 rounded-full font-bold">Approve</button>
                      )}
                      <button onClick={() => api.delete(`/reviews/${r.id}/`).then(loadAdminData)} className="text-[11px] border border-slate-200 text-rose-600 px-3 py-1 rounded-full font-bold">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: AI CUSTOMER SERVICE FAQ KNOWLEDGE BASE (0-Token PostgreSQL Guides) */}
        {activeTab === 'support-kb' && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Zero-Token Customer Service Engine</h3>
                  <p className="text-xs text-slate-500">
                    When a customer asks a question matching any trigger keyword below, Aura AI replies directly from PostgreSQL in &lt;5ms using <strong>0 API tokens</strong>.
                  </p>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-2xl text-center shrink-0">
                <span className="block text-lg font-black text-emerald-700">{totalZeroTokenHits}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">0-Token Replies Served</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {supportGuides.map(guide => (
                <div
                  key={guide.id}
                  className={`bg-white rounded-3xl border p-6 shadow-sm flex flex-col justify-between transition ${
                    guide.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">#{guide.topic_slug}</span>
                        <h4 className="font-black text-base text-slate-900 tracking-tight">{guide.title}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
                          {guide.hit_count} Hits
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleGuideActive(guide)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                            guide.is_active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {guide.is_active ? 'Active' : 'Paused'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Trigger Keywords</span>
                      <div className="flex flex-wrap gap-1.5">
                        {guide.keywords.split(',').slice(0, 8).map((kw, i) => (
                          <span key={i} className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[11px] font-semibold">
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-xs text-slate-600 whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
                      {guide.response_markdown}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEditGuideModal(guide)}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Guide
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSupportGuide(guide.id)}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Customer Service FAQ Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveSupportGuide} className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {editingGuideId !== null ? 'Edit Customer Service Guide' : 'New Customer Service FAQ Guide'}
                </h3>
                <p className="text-xs text-slate-500">Stored in PostgreSQL and served at 0 AI tokens when matched</p>
              </div>
              <button type="button" onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-slate-900 p-1.5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Guide Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. How to Create an Account & Sign In"
                value={guideForm.title}
                onChange={e => setGuideForm({ ...guideForm, title: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Trigger Keywords (Comma-Separated Phrases) *
              </label>
              <input
                type="text"
                required
                placeholder="create account, sign up, register, how to login, forgot password"
                value={guideForm.keywords}
                onChange={e => setGuideForm({ ...guideForm, keywords: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Step-by-Step Response (Supports **Bold**, 1. Numbered Lists, * Bullets & [Links](/url)) *
              </label>
              <textarea
                rows={8}
                required
                placeholder="**Step-by-Step Guide:**&#10;1. Click **Sign In** at the top-right...&#10;2. Enter your details..."
                value={guideForm.response_markdown}
                onChange={e => setGuideForm({ ...guideForm, response_markdown: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-2xl text-xs font-mono leading-relaxed focus:bg-white focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guideForm.is_active}
                  onChange={e => setGuideForm({ ...guideForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">Active in AI Assistant</span>
              </label>

              <div className="flex gap-2.5">
                <button type="button" onClick={() => setShowGuideModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-full text-xs font-bold text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold shadow-sm transition">
                  {editingGuideId !== null ? 'Save Guide Changes' : 'Publish FAQ Guide'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCsvUploadSubmit} className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xl font-black text-slate-900">Bulk CSV Import</h3>
              <button type="button" onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-900 p-1"><X className="w-5 h-5" /></button>
            </div>
            <input type="file" accept=".csv" required onChange={e => setCsvFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCsvModal(false)} className="px-4 py-2 border border-slate-200 rounded-full text-xs font-bold">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold">Import CSV</button>
            </div>
          </form>
        </div>
      )}

      {/* Create Staff Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createAdminUser(newAdmin);
                setShowAddAdminModal(false);
                loadAdminData();
              } catch (err: any) {
                alert(err.response?.data?.error || 'Error creating admin');
              }
            }}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xl font-black text-slate-900">Add Staff Admin</h3>
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-slate-900"><X className="w-5 h-5" /></button>
            </div>
            <input type="text" required placeholder="Full Name" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })} />
            <input type="tel" required placeholder="Phone Number" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" onChange={e => setNewAdmin({ ...newAdmin, phone: e.target.value })} />
            <input type="email" required placeholder="Email Address" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} />
            <input type="password" required placeholder="Password" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="px-4 py-2 border border-slate-200 rounded-full text-xs font-bold">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-slate-900 text-white rounded-full text-xs font-bold">Create Admin</button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleProductSubmit} className="bg-white rounded-3xl w-full max-w-4xl my-8 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="bg-white border-b border-slate-100 px-6 py-5 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black text-slate-900">{editingProductId !== null ? 'Edit Product' : 'Add New Product'}</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-full"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex border-b border-slate-100 overflow-x-auto px-4 bg-slate-50 shrink-0 no-scrollbar">
              {[
                { id: 'vital', icon: Info, label: 'Vital Info' },
                { id: 'offer', icon: Tag, label: 'Pricing & Stock' },
                { id: 'variants', icon: Layers, label: 'Variations' },
                { id: 'images', icon: ImagePlus, label: 'Media' },
                { id: 'description', icon: ListTree, label: 'Specs & Details' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProductFormTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                    productFormTab === tab.id ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-white space-y-6">
              {productFormTab === 'vital' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Product Title *</label>
                    <input type="text" required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase">Category *</label>
                        <button type="button" onClick={() => setShowCatInput(!showCatInput)} className="text-[10px] text-indigo-600 font-bold hover:underline">+ New Category</button>
                      </div>
                      {showCatInput ? (
                        <div className="flex gap-2">
                          <input type="text" placeholder="Category Name" className="border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs flex-1" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                          <button type="button" onClick={handleInlineCreateCategory} className="bg-slate-900 text-white px-4 rounded-xl text-xs font-bold">Save</button>
                        </div>
                      ) : (
                        <select required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.category} onChange={e => setNewProd({ ...newProd, category: e.target.value })}>
                          <option value="">Select Category</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase">Brand *</label>
                        <button type="button" onClick={() => setShowBrandInput(!showBrandInput)} className="text-[10px] text-indigo-600 font-bold hover:underline">
                          {showBrandInput && existingBrands.length > 0 ? 'Select Existing' : '+ New Brand'}
                        </button>
                      </div>
                      {showBrandInput || existingBrands.length === 0 ? (
                        <input type="text" placeholder="e.g. Apple, Sony, Asus" required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.brand} onChange={e => setNewProd({ ...newProd, brand: e.target.value })} />
                      ) : (
                        <select required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.brand} onChange={e => setNewProd({ ...newProd, brand: e.target.value })}>
                          <option value="">Select Brand</option>
                          {existingBrands.map((b, i) => <option key={i} value={b}>{b}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Product Code / SKU</label>
                      <input type="text" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.product_code} onChange={e => setNewProd({ ...newProd, product_code: e.target.value })} />
                    </div>
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => setNewProd({ ...newProd, is_featured: !newProd.is_featured })}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black transition ${
                          newProd.is_featured
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${newProd.is_featured ? 'fill-slate-950 text-slate-950' : ''}`} />
                        {newProd.is_featured ? 'Featured on Homepage ★' : 'Click to Feature on Homepage'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {productFormTab === 'offer' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Selling Price (৳) *</label>
                    <input type="number" step="0.01" required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.cash_discount_price} onChange={e => setNewProd({ ...newProd, cash_discount_price: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Regular Price (৳)</label>
                    <input type="number" step="0.01" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.regular_price} onChange={e => setNewProd({ ...newProd, regular_price: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Stock Quantity *</label>
                    <input type="number" required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-semibold" value={newProd.stock} onChange={e => setNewProd({ ...newProd, stock: Number(e.target.value) })} />
                  </div>
                </div>
              )}

              {productFormTab === 'variants' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Options (e.g., Color, RAM, Storage)</span>
                    <button type="button" onClick={addVariant} className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold">+ Add Variation</button>
                  </div>
                  {newProd.variants.map((variant, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="text" placeholder="Name (e.g. Color)" className="w-1/3 border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs" value={variant.name} onChange={e => { const updated = [...newProd.variants]; updated[idx].name = e.target.value; setNewProd({ ...newProd, variants: updated }); }} />
                      <input type="text" placeholder="Comma-separated (Black, Silver)" className="flex-1 border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs" value={variant.options} onChange={e => { const updated = [...newProd.variants]; updated[idx].options = e.target.value; setNewProd({ ...newProd, variants: updated }); }} />
                      <button type="button" onClick={() => removeVariant(idx)} className="text-rose-500 p-2"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              {productFormTab === 'images' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Primary Image URL *</label>
                    <input type="url" required placeholder="https://..." className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs" value={newProd.image_url} onChange={e => setNewProd({ ...newProd, image_url: e.target.value })} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Additional Gallery URLs</label>
                      <button type="button" onClick={addGalleryImage} className="text-xs font-bold text-indigo-600">+ Add Image URL</button>
                    </div>
                    <div className="space-y-2">
                      {newProd.image_gallery.map((url, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input type="url" placeholder="https://..." className="flex-1 border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs" value={url} onChange={e => { const updated = [...newProd.image_gallery]; updated[idx] = e.target.value; setNewProd({ ...newProd, image_gallery: updated }); }} />
                          <button type="button" onClick={() => removeGalleryImage(idx)} className="text-rose-500 p-2"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {productFormTab === 'description' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5"><Box className="w-3.5 h-3.5 inline mr-1" /> Box Contents (One per line)</label>
                    <textarea rows={2} placeholder="Charger&#10;USB-C Cable" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-mono" value={newProd.whats_in_box} onChange={e => setNewProd({ ...newProd, whats_in_box: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Key Features (One per line)</label>
                    <textarea rows={3} placeholder="Display: 120Hz AMOLED..." className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs font-mono" value={newProd.key_features_text} onChange={e => setNewProd({ ...newProd, key_features_text: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Rich Description (HTML/Text) *</label>
                    <textarea rows={4} required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-2xl text-xs" value={newProd.description} onChange={e => setNewProd({ ...newProd, description: e.target.value })} />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-900 uppercase tracking-widest">Specifications Builder (Multi-line values supported)</label>
                      <button type="button" onClick={addSpecGroup} className="text-xs font-bold text-slate-900 bg-slate-100 px-3.5 py-1.5 rounded-full hover:bg-slate-200 transition">+ Add Spec Group</button>
                    </div>
                    {newProd.specifications.map((group, gIdx) => (
                      <div key={gIdx} className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-900"
                            value={group.groupName}
                            onChange={e => {
                              const updated = [...newProd.specifications];
                              updated[gIdx].groupName = e.target.value;
                              setNewProd({ ...newProd, specifications: updated });
                            }}
                            placeholder="Group Name (e.g. Display)"
                          />
                          <button type="button" onClick={() => removeSpecGroup(gIdx)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-2">
                          {group.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <input
                                type="text"
                                placeholder="Specification Key"
                                className="w-full sm:w-1/3 border border-slate-200 p-2 rounded-xl text-xs bg-white"
                                value={feat.key}
                                onChange={e => {
                                  const updated = [...newProd.specifications];
                                  updated[gIdx].features[fIdx].key = e.target.value;
                                  setNewProd({ ...newProd, specifications: updated });
                                }}
                              />
                              <textarea
                                rows={1}
                                placeholder="Value"
                                className="w-full flex-1 border border-slate-200 p-2 rounded-xl text-xs bg-white resize-y"
                                value={feat.value}
                                onChange={e => {
                                  const updated = [...newProd.specifications];
                                  updated[gIdx].features[fIdx].value = e.target.value;
                                  setNewProd({ ...newProd, specifications: updated });
                                }}
                              />
                              <button type="button" onClick={() => removeSpecFeature(gIdx, fIdx)} className="text-slate-400 hover:text-rose-600 p-2"><X className="w-4 h-4" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addSpecFeature(gIdx)} className="text-[11px] font-bold text-indigo-600 hover:underline pt-1 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add Specification Row
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-2.5 shrink-0">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-full text-xs font-bold text-slate-600">Cancel</button>
              <button type="submit" className="px-6 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold shadow-sm">
                {editingProductId !== null ? 'Save Changes' : 'Publish Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};