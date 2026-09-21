import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import api, { fetchProducts, fetchCategories } from '../api';
import type { Product, Category } from '../types';
import { Sparkles, Search, XCircle, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    setMinPrice(''); setMaxPrice(''); setInStockOnly(false); setSelectedBrands([]);
  }, [categoryQuery, searchQuery, viewAllQuery]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [prods, cats, bannersRes] = await Promise.all([
          fetchProducts(categoryQuery || undefined, searchQuery || undefined),
          fetchCategories(),
          api.get('/banners/')
        ]);
        setProducts(prods); 
        setCategories(cats);
        
        const rawBanners = bannersRes.data || [];
        const validBanners = rawBanners.filter((b: any) => {
          const isActive = b.is_active !== false;
          const hasImg = Boolean(b.image_display_url || b.image_url || b.image);
          return isActive && hasImg;
        });
        
        setBanners(validBanners);
      } catch (error) { 
        console.error("Failed to load store data", error); 
      } finally { 
        setLoading(false); 
      }
    };
    loadData();
    setLocalSearch(searchQuery || '');
  }, [categoryQuery, searchQuery]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

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

  const toggleBrand = (brand: string) => setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);

  const availableBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(b => Boolean(b) && String(b).trim() !== ''))).sort(), [products]);

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

  const isDefaultHomeView = !categoryQuery && !searchQuery && !viewAllQuery;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10 font-sans w-full">
      
      {/* HERO SECTION: Dynamic Banner Carousel OR Static Fallback */}
      {isDefaultHomeView && (
        <div className="w-full block">
          {banners.length > 0 ? (
            <div className="relative w-full rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 h-[220px] sm:h-[320px] md:h-[420px] bg-slate-900 group">
              {banners.map((b, idx) => {
                let imgSrc = b.image_display_url || b.image_url;
                if (!imgSrc && b.image) {
                  imgSrc = b.image.startsWith('http') ? b.image : `http://127.0.0.1:8000${b.image}`;
                }
                return (
                  <div 
                    key={b.id || idx} 
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                  >
                    {b.link ? (
                      <a href={b.link} target="_blank" rel="noreferrer" className="w-full h-full block">
                        <img src={imgSrc} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <img src={imgSrc} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
                    )}
                  </div>
                );
              })}
              
              {banners.length > 1 && (
                <>
                  <button onClick={() => setCurrentBanner((prev) => (prev === 0 ? banners.length - 1 : prev - 1))} aria-label="Previous banner" className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/30 hover:bg-slate-900/70 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)} aria-label="Next banner" className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/30 hover:bg-slate-900/70 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  
                  <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2.5">
                    {banners.map((_, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setCurrentBanner(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-2.5 rounded-full transition-all duration-500 shadow-sm ${idx === currentBanner ? 'bg-white w-8' : 'bg-white/50 w-2.5 hover:bg-white/80'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 rounded-[2.5rem] p-10 md:p-16 text-white shadow-2xl relative overflow-hidden flex items-center min-h-[360px] w-full">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500 opacity-20 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500 opacity-10 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
              
              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold mb-6 tracking-wide uppercase">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Powered by Gemini
                </div>
                <h1 className="text-4xl md:text-6xl font-black mb-6 leading-[1.1] tracking-tight">
                  Curated tech, <br className="hidden md:block"/>analyzed by AI.
                </h1>
                <p className="text-slate-400 text-base md:text-lg font-medium leading-relaxed max-w-xl">
                  Experience the future of e-commerce. Personalized recommendations, instant spec breakdowns, and seamless checkout.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FILTER PILLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button onClick={() => setCategory(null)} className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${viewAllQuery || isDefaultHomeView ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600'}`}>
            All Collection
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCategory(c.slug)} className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${categoryQuery === c.slug ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600'}`}>
              {c.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleLocalSearchSubmit} className="relative w-full md:w-72 shrink-0">
          <input type="text" placeholder="Search the catalog..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-sm" />
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        </form>
      </div>

      {(!isDefaultHomeView && (searchQuery || categoryQuery || viewAllQuery)) && (
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-medium text-slate-600 bg-slate-50/50 px-6 py-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Results for</span>
            {viewAllQuery && <span className="px-3 py-1 bg-white border border-slate-200 rounded-full font-bold text-slate-900 shadow-sm">Entire Catalog</span>}
            {categoryQuery && <span className="px-3 py-1 bg-white border border-slate-200 rounded-full font-bold text-slate-900 shadow-sm">{categories.find(c => c.slug === categoryQuery)?.name || categoryQuery}</span>}
            {searchQuery && <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full font-bold text-indigo-700 shadow-sm">"{searchQuery}"</span>}
          </div>
          <button onClick={() => { setLocalSearch(''); setSearchParams({}); }} className="text-slate-500 hover:text-slate-900 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center gap-2 font-bold shadow-sm">
            <XCircle className="w-4 h-4" /> Clear All
          </button>
        </div>
      )}

      {isDefaultHomeView && !loading && products.length > 0 && (
        <div className="pt-4 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Featured Products</h2>
        </div>
      )}

      {loading ? (
        <div className="py-32 text-center text-slate-400 font-bold flex flex-col items-center justify-center space-y-4 w-full">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
          <p>Curating catalog...</p>
        </div>
      ) : isDefaultHomeView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
          {products.slice(0, 12).map(product => (
            <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full w-full">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start w-full">
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-4 tracking-tight">Price Range</h3>
              <div className="flex items-center gap-3">
                <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition" />
                <span className="text-slate-300">-</span>
                <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-4 tracking-tight">Availability</h3>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${inStockOnly ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-300 group-hover:border-slate-400'}`}>
                  {inStockOnly && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-medium text-slate-700">In Stock Only</span>
                <input type="checkbox" className="sr-only" checked={inStockOnly} onChange={() => setInStockOnly(!inStockOnly)} />
              </label>
            </div>

            {availableBrands.length > 0 && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 tracking-tight">Brands</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {availableBrands.map((brand, idx) => (
                    <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedBrands.includes(brand) ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-300 group-hover:border-slate-400'}`}>
                        {selectedBrands.includes(brand) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{brand}</span>
                      <input type="checkbox" className="sr-only" checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 w-full">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {filteredProducts.map(product => (
                  <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full w-full">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-100 shadow-sm w-full">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">No products found</h3>
                <p className="text-slate-500 mb-6">Try adjusting your filters or search query.</p>
                <button onClick={() => { setMinPrice(''); setMaxPrice(''); setInStockOnly(false); setSelectedBrands([]); }} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold shadow-md transition">
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};