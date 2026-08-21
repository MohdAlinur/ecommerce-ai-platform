import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Users, FolderPlus, X, Edit2 } from 'lucide-react';
import type { AnalyticsData, Category, Product, UserProfile } from '../types';
import { fetchAdminAnalytics, fetchCategories, createCategory, createProduct, updateProduct, deleteProduct, fetchAllUsers, deleteUserAccount, fetchProducts } from '../api';

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'users'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals & Editing State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  
  // Inline Creation States
  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showBrandInput, setShowBrandInput] = useState(false);

  // Derived existing brands
  const existingBrands = Array.from(new Set(products.map(p => p.brand).filter(b => b && b.trim() !== ''))) as string[];

  // Product Form State
  const [newProd, setNewProd] = useState({
    name: '',
    category: '',
    brand: '',
    product_code: '',
    description: '',
    cash_discount_price: '0',
    regular_price: '0',
    stock: 10,
    image_url: '',
    key_features_text: '',
    specifications: [{ groupName: 'General Information', features: [{ key: '', value: '' }] }]
  });

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [analytics, cats, userList, prodList] = await Promise.all([
        fetchAdminAnalytics(),
        fetchCategories(),
        fetchAllUsers(),
        fetchProducts()
      ]);
      setData(analytics);
      setCategories(cats);
      setUsers(userList);
      setProducts(prodList);
      
      if (prodList.length === 0 || !prodList.some(p => p.brand)) {
        setShowBrandInput(true);
      }
      
      setError(null);
    } catch (err: any) {
      console.error("Dashboard Load Error:", err);
      setError(err.response?.status === 403 ? "Access Denied: Admin only." : "Error loading dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); }, []);

  const handleInlineCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await createCategory(newCatName.trim());
      setCategories([...categories, created]);
      setNewProd({ ...newProd, category: String(created.id) });
      setNewCatName('');
      setShowCatInput(false);
    } catch (err: any) {
      alert(err.response?.data?.name?.[0] || 'Failed to create category.');
    }
  };

  const handleOpenAddModal = () => {
    setEditingProductId(null);
    setNewProd({
      name: '', category: '', brand: '', product_code: '', description: '',
      cash_discount_price: '0', regular_price: '0', stock: 10, image_url: '', key_features_text: '',
      specifications: [{ groupName: 'General Information', features: [{ key: '', value: '' }] }]
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProductId(p.id);
    const featuresStr = Array.isArray(p.key_features) ? p.key_features.join('\n') : '';
    setNewProd({
      name: p.name || '', category: String(p.category || ''), brand: p.brand || '', product_code: p.product_code || '',
      description: p.description || '', cash_discount_price: String(p.cash_discount_price || '0'),
      regular_price: String(p.regular_price || '0'), stock: p.stock ?? 10, image_url: p.image_url || '',
      key_features_text: featuresStr,
      specifications: Array.isArray(p.specifications) && p.specifications.length > 0 
        ? p.specifications 
        : [{ groupName: 'General Information', features: [{ key: '', value: '' }] }]
    });
    if (p.brand && !existingBrands.includes(p.brand)) setShowBrandInput(true);
    setShowAddModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        loadAdminData();
      } catch (err: any) {
        alert('Failed to delete product.');
      }
    }
  };

  const handleDeleteUserAccount = async (id: number) => {
    if (confirm('Are you sure you want to remove this user account?')) {
      try {
        await deleteUserAccount(id);
        loadAdminData();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete user.');
      }
    }
  };

  const addSpecGroup = () => {
    setNewProd({ ...newProd, specifications: [...newProd.specifications, { groupName: 'New Group', features: [{ key: '', value: '' }] }] });
  };
  const removeSpecGroup = (groupIndex: number) => {
    setNewProd({ ...newProd, specifications: newProd.specifications.filter((_, idx) => idx !== groupIndex) });
  };
  const addSpecFeature = (groupIndex: number) => {
    const updated = [...newProd.specifications];
    updated[groupIndex].features.push({ key: '', value: '' });
    setNewProd({ ...newProd, specifications: updated });
  };
  const removeSpecFeature = (groupIndex: number, featIndex: number) => {
    const updated = [...newProd.specifications];
    updated[groupIndex].features = updated[groupIndex].features.filter((_, idx) => idx !== featIndex);
    setNewProd({ ...newProd, specifications: updated });
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', newProd.name);
    formData.append('category', String(newProd.category));
    formData.append('brand', newProd.brand);
    formData.append('product_code', newProd.product_code);
    formData.append('description', newProd.description);
    formData.append('cash_discount_price', newProd.cash_discount_price);
    formData.append('regular_price', newProd.regular_price);
    formData.append('stock', String(newProd.stock));
    formData.append('image_url', newProd.image_url);

    const featuresList = newProd.key_features_text.split('\n').filter(f => f.trim() !== '');
    formData.append('key_features', JSON.stringify(featuresList));
    formData.append('specifications', JSON.stringify(newProd.specifications));

    try {
      if (editingProductId !== null) {
        await updateProduct(editingProductId, formData);
        alert('Product updated successfully!');
      } else {
        await createProduct(formData);
        alert('Product added successfully!');
      }
      setShowAddModal(false);
      loadAdminData();
    } catch (err: any) {
      console.error('Product save error:', err.response?.data);
      alert('Error saving product. Check console.');
    }
  };

  if (loading) return <div className="p-20 text-center font-bold text-slate-500">Loading admin console...</div>;
  if (error) return <div className="p-20 text-center font-bold text-rose-600">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Admin Dashboard</h2>
          <p className="text-slate-500 text-sm">Manage store inventory, categories, and accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'overview' ? 'bg-[#3749bb] text-white' : 'bg-white border text-slate-600'}`}>Analytics</button>
          <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'products' ? 'bg-[#3749bb] text-white' : 'bg-white border text-slate-600'}`}>Products</button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'users' ? 'bg-[#3749bb] text-white' : 'bg-white border text-slate-600'}`}>Users</button>
          
          <button onClick={handleOpenAddModal} className="flex items-center gap-1.5 bg-[#ef4a23] hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow">
            <Plus className="w-4 h-4"/> Add Product
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl shadow-sm border"><h3 className="text-2xl font-black text-slate-900">৳{data?.metrics.total_revenue.toLocaleString()}</h3><p className="text-xs text-slate-400 font-semibold uppercase">Revenue</p></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border"><h3 className="text-2xl font-black text-slate-900">{data?.metrics.total_orders}</h3><p className="text-xs text-slate-400 font-semibold uppercase">Orders</p></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border"><h3 className="text-2xl font-black text-slate-900">{data?.metrics.total_products}</h3><p className="text-xs text-slate-400 font-semibold uppercase">Products</p></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border"><h3 className="text-2xl font-black text-slate-900">{data?.metrics.average_rating}</h3><p className="text-xs text-slate-400 font-semibold uppercase">Avg Rating</p></div>
        </div>
      ) : activeTab === 'products' ? (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden p-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600">
                <th className="p-3">Product Name</th>
                <th className="p-3">Category & Brand</th>
                <th className="p-3">Price</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 transition">
                  <td className="p-3 flex items-center gap-3">
                    <img src={p.image_display_url || 'https://via.placeholder.com/40'} alt={p.name} className="w-10 h-10 object-contain rounded border bg-white p-1" />
                    <span className="font-semibold text-slate-900 line-clamp-1">{p.name}</span>
                  </td>
                  <td className="p-3">
                    <span className="block text-slate-900 font-semibold">{p.category_name || 'N/A'}</span>
                    <span className="text-xs text-slate-500">{p.brand}</span>
                  </td>
                  <td className="p-3 font-black text-[#ef4a23]">৳{Number(p.cash_discount_price).toLocaleString()}</td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => handleOpenEditModal(p)} className="text-[#3749bb] hover:text-indigo-800 p-1" title="Edit Product"><Edit2 className="w-4 h-4 inline"/></button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="text-slate-400 hover:text-rose-600 p-1" title="Delete Product"><Trash2 className="w-4 h-4 inline"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden p-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600">
                <th className="p-3">Username</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-3 font-medium text-slate-900">{u.username}</td>
                  <td className="p-3 text-slate-600">{u.email || 'N/A'}</td>
                  <td className="p-3"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.is_staff ? 'bg-indigo-50 text-[#3749bb]' : 'bg-slate-100 text-slate-600'}`}>{u.is_staff ? 'Admin' : 'Customer'}</span></td>
                  <td className="p-3 text-right">{!u.is_superuser && <button onClick={() => handleDeleteUserAccount(u.id)} className="text-rose-600"><Trash2 className="w-4 h-4"/></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleProductSubmit} className="bg-white rounded-2xl p-6 w-full max-w-3xl my-8 shadow-2xl border max-h-[90vh] overflow-y-auto space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-xl font-extrabold text-slate-900">
                {editingProductId !== null ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Name</label>
              <input type="text" required className="w-full border p-2.5 rounded-xl text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb]" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">Category</label>
                  <button type="button" onClick={() => setShowCatInput(!showCatInput)} className="text-xs text-[#3749bb] font-semibold hover:underline">
                    {showCatInput ? 'Cancel' : '+ New'}
                  </button>
                </div>
                {showCatInput ? (
                  <div className="flex gap-2 mb-2">
                    <input type="text" placeholder="Category Name..." className="flex-1 border p-2 rounded-xl text-sm" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                    <button type="button" onClick={handleInlineCreateCategory} className="bg-[#3749bb] text-white px-3 py-2 rounded-xl text-xs font-semibold">Save</button>
                  </div>
                ) : (
                  <select required className="w-full border p-2.5 rounded-xl text-sm bg-white focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb]" value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value})}>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Brand</label>
                  <button type="button" onClick={() => setShowBrandInput(!showBrandInput)} className="text-xs text-[#3749bb] font-semibold hover:underline">
                    {showBrandInput && existingBrands.length > 0 ? 'Select Existing' : '+ Add New'}
                  </button>
                </div>
                {showBrandInput || existingBrands.length === 0 ? (
                  <input type="text" placeholder="Enter Brand Name" required className="w-full border p-2.5 rounded-xl text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb]" value={newProd.brand} onChange={e => setNewProd({...newProd, brand: e.target.value})} />
                ) : (
                  <select required className="w-full border p-2.5 rounded-xl text-sm bg-white focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb]" value={newProd.brand} onChange={e => setNewProd({...newProd, brand: e.target.value})}>
                    <option value="">Select Brand</option>
                    {existingBrands.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Price (৳)</label>
                <input type="number" step="0.01" required className="w-full border p-2.5 rounded-xl text-sm" value={newProd.cash_discount_price} onChange={e => setNewProd({...newProd, cash_discount_price: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Old Price (৳) [Optional]</label>
                <input type="number" step="0.01" className="w-full border p-2.5 rounded-xl text-sm" value={newProd.regular_price} onChange={e => setNewProd({...newProd, regular_price: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Stock</label>
                <input type="number" required className="w-full border p-2.5 rounded-xl text-sm" value={newProd.stock} onChange={e => setNewProd({...newProd, stock: Number(e.target.value)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Code</label>
                <input type="text" className="w-full border p-2.5 rounded-xl text-sm" value={newProd.product_code} onChange={e => setNewProd({...newProd, product_code: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Image URL</label>
                <input type="url" placeholder="https://..." className="w-full border p-2.5 rounded-xl text-sm" value={newProd.image_url} onChange={e => setNewProd({...newProd, image_url: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
              <textarea rows={3} required className="w-full border p-2.5 rounded-xl text-sm" value={newProd.description} onChange={e => setNewProd({...newProd, description: e.target.value})} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">At a Glimpse Features (One per line)</label>
              <textarea rows={2} placeholder="e.g. 128GB Storage&#10;OLED Display" className="w-full border p-2.5 rounded-xl text-sm font-mono bg-slate-50" value={newProd.key_features_text} onChange={e => setNewProd({...newProd, key_features_text: e.target.value})} />
            </div>

            {/* DETAILED SPECIFICATIONS BUILDER */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 uppercase">Detailed Specifications</label>
                <button type="button" onClick={addSpecGroup} className="text-xs font-bold text-[#3749bb] hover:underline">+ Add Category Group</button>
              </div>

              {newProd.specifications.map((group, gIdx) => (
                <div key={gIdx} className="p-3 bg-slate-50 border rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" className="flex-1 border p-2 rounded-lg text-sm font-bold bg-white" value={group.groupName} onChange={e => {
                      const updated = [...newProd.specifications];
                      updated[gIdx].groupName = e.target.value;
                      setNewProd({...newProd, specifications: updated});
                    }} placeholder="Group Name (e.g. General Information)" />
                    <button type="button" onClick={() => removeSpecGroup(gIdx)} className="text-rose-600 hover:text-rose-800 p-2 bg-white rounded-lg border"><Trash2 className="w-4 h-4"/></button>
                  </div>

                  <div className="space-y-2 pl-2 mt-2">
                    {group.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex flex-col sm:flex-row items-center gap-2">
                        <input type="text" placeholder="Spec Name (e.g. Battery Type)" className="sm:w-1/3 w-full border p-2 rounded-lg text-xs bg-white" value={feat.key} onChange={e => {
                          const updated = [...newProd.specifications];
                          updated[gIdx].features[fIdx].key = e.target.value;
                          setNewProd({...newProd, specifications: updated});
                        }} />
                        <input type="text" placeholder="Spec Value (e.g. LiFePO4)" className="flex-1 w-full border p-2 rounded-lg text-xs bg-white" value={feat.value} onChange={e => {
                          const updated = [...newProd.specifications];
                          updated[gIdx].features[fIdx].value = e.target.value;
                          setNewProd({...newProd, specifications: updated});
                        }} />
                        <button type="button" onClick={() => removeSpecFeature(gIdx, fIdx)} className="text-slate-400 hover:text-rose-600 p-1"><X className="w-4 h-4"/></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addSpecFeature(gIdx)} className="text-[11px] font-semibold text-[#3749bb] hover:underline pt-1 block">+ Add Feature</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 border rounded-xl text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button type="submit" className="px-6 py-2.5 bg-[#3749bb] hover:bg-indigo-900 text-white rounded-xl text-sm font-bold shadow-md">
                {editingProductId !== null ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};