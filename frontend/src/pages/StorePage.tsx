import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { fetchProducts, fetchCategories } from '../api';
import type { Product, Category } from '../types';
import { Sparkles, Search, XCircle, Filter, ChevronRight, CheckSquare } from 'lucide-react';

interface StorePageProps {
  onProductSelect: (p: Product) => void;
}

export const StorePage: React.FC<StorePageProps> = ({ onProductSelect }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryQuery = searchParams.get('category');
  const searchQuery = searchParams.get('search');
  const viewAllQuery = searchParams.get('view') === 'all';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  // Sidebar Filter States
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  // Reset frontend filters when URL parameters change
  useEffect(() => {
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSelectedBrands([]);
  }, [categoryQuery, searchQuery, viewAllQuery]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [prods, cats] = await Promise.all([
          fetchProducts(categoryQuery || undefined, searchQuery || undefined),
          fetchCategories()
        ]);
        setProducts(prods);
        setCategories(cats);
      } catch (error) {
        console.error("Failed to load store data", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    setLocalSearch(searchQuery || '');
  }, [categoryQuery, searchQuery]);

  const handleLocalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (categoryQuery) params.set('category', categoryQuery);
    if (localSearch.trim()) params.set('search', localSearch.trim());
    setSearchParams(params);
  };

  const setCategory = (slug: string | null) => {
    const params = new URLSearchParams();
    if (slug) {
      params.set('category', slug);
      if (searchQuery) params.set('search', searchQuery);
    } else {
      params.set('view', 'all'); 
    }
    setSearchParams(params);
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev => 
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  // Derive dynamic brands available in the current product list
  const availableBrands = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brand).filter(b => Boolean(b) && String(b).trim() !== ''))).sort();
  }, [products]);

  // Apply frontend filters (Price, Stock, Brand)
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const price = Number(p.cash_discount_price || p.price || 0);
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (selectedBrands.length > 0 && (!p.brand || !selectedBrands.includes(p.brand))) return false;
      return true;
    });
  }, [products, minPrice, maxPrice, inStockOnly, selectedBrands]);

  // Default home view is TRUE only if there are no searches, no categories, and user hasn't clicked "All Products"
  const isDefaultHomeView = !categoryQuery && !searchQuery && !viewAllQuery;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 font-sans">
      
      {/* Hero Banner (Only visible on Home View) */}
      {isDefaultHomeView && (
        <div className="bg-gradient-to-br from-[#3749bb] to-purple-700 rounded-3xl p-10 md:p-16 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold mb-6">
              <Sparkles className="w-4 h-4" /> AI-Driven E-Commerce Experience
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight tracking-tight">
              Next-Gen Shopping With Instant AI Reviews
            </h1>
            <p className="text-indigo-100 text-sm md:text-base font-medium leading-relaxed max-w-xl">
              Explore premium products backed by Gemini AI review summaries and 24/7 intelligent customer assistance.
            </p>
          </div>
        </div>
      )}

      {/* Filter Pill Buttons & Local Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto p-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button 
            onClick={() => setCategory(null)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors shadow-sm ${viewAllQuery || isDefaultHomeView ? 'bg-[#3749bb] text-white' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'}`}
          >
            All Products
          </button>
          {categories.map(c => (
            <button 
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors shadow-sm ${categoryQuery === c.slug ? 'bg-[#3749bb] text-white' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleLocalSearchSubmit} className="relative w-full md:w-64 shrink-0 px-2 pb-2 md:pb-0 md:pr-2">
          <input 
            type="text"
            placeholder="Search products..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#3749bb] focus:border-[#3749bb] transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-5 top-3.5" />
        </form>
      </div>

      {/* Active Filter Indicator */}
      {(!isDefaultHomeView && (searchQuery || categoryQuery || viewAllQuery)) && (
        <div className="flex items-center justify-between text-sm font-bold text-slate-600 bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm">
          <div>
            Showing results for: 
            {viewAllQuery && <span className="text-[#3749bb] ml-1">"Entire Catalog"</span>}
            {categoryQuery && <span className="text-[#3749bb] ml-1">Category "{categories.find(c => c.slug === categoryQuery)?.name || categoryQuery}"</span>}
            {categoryQuery && searchQuery && <span> and </span>}
            {searchQuery && <span className="text-[#ef4a23] ml-1">"{searchQuery}"</span>}
          </div>
          <button 
            onClick={() => {
              setLocalSearch('');
              setSearchParams({});
            }} 
            className="text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
          >
            <XCircle className="w-4 h-4" /> Clear Filters
          </button>
        </div>
      )}

      {/* Featured Header (Only shows on home view) */}
      {isDefaultHomeView && !loading && products.length > 0 && (
        <div className="text-center pt-4 pb-2">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Featured Products</h2>
          <p className="text-slate-500 text-sm font-medium">Check & Get Your Desired Product!</p>
        </div>
      )}

      {/* DYNAMIC LAYOUT: Full Grid for Home, 2-Column with Sidebar for Categories */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-bold">Loading amazing products...</div>
      ) : isDefaultHomeView ? (
        // --- HOME PAGE VIEW (FEATURED PRODUCTS ONLY) ---
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.slice(0, 12).map(product => (
            <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        // --- CATEGORY / SEARCH VIEW (SIDEBAR + GRID) ---
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* LEFT SIDEBAR (Star Tech Style Filters) */}
          <div className="lg:col-span-1 space-y-4 sticky top-[120px]">
            
            {/* Price Filter */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">Price Range</h3>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={minPrice} 
                  onChange={e => setMinPrice(e.target.value)} 
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none" 
                />
                <span className="text-slate-400 font-bold">-</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={maxPrice} 
                  onChange={e => setMaxPrice(e.target.value)} 
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none" 
                />
              </div>
            </div>

            {/* Availability Filter */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">Availability</h3>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${inStockOnly ? 'bg-[#ef4a23] border-[#ef4a23]' : 'bg-slate-50 border-slate-300 group-hover:border-[#ef4a23]'}`}>
                  {inStockOnly && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-semibold text-slate-700">In Stock</span>
                <input type="checkbox" className="sr-only" checked={inStockOnly} onChange={() => setInStockOnly(!inStockOnly)} />
              </label>
            </div>

            {/* Dynamic Brand Filter */}
            {availableBrands.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4">Brand</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {availableBrands.map((brand, idx) => (
                    <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedBrands.includes(brand) ? 'bg-[#ef4a23] border-[#ef4a23]' : 'bg-slate-50 border-slate-300 group-hover:border-[#ef4a23]'}`}>
                        {selectedBrands.includes(brand) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 line-clamp-1">{brand}</span>
                      <input type="checkbox" className="sr-only" checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PRODUCT GRID */}
          <div className="lg:col-span-3">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-5xl mb-4">🛒</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No matching products</h3>
                <p className="text-slate-500 mb-6">Try clearing your price, stock, or brand filters.</p>
                <button 
                  onClick={() => { setMinPrice(''); setMaxPrice(''); setInStockOnly(false); setSelectedBrands([]); }} 
                  className="px-6 py-2.5 bg-[#ef4a23] text-white rounded-xl font-bold shadow-md transition"
                >
                  Clear Sidebar Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};