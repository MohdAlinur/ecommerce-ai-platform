import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { fetchProducts, fetchCategories, fetchStoreHighlights } from '../api';
import type { Product, Category, StoreHighlights } from '../types';
import {
  Sparkles, Search, XCircle, CheckSquare, SlidersHorizontal,
  ArrowUpDown, ShieldCheck, Truck, RotateCcw, PackageCheck,
  Clock, Tag, ArrowRight, Star
} from 'lucide-react';

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
  const [highlights, setHighlights] = useState<StoreHighlights | null>(null);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'rating'>('newest');

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
        const [prods, cats, storeStats] = await Promise.all([
          fetchProducts(categoryQuery || undefined, searchQuery || undefined),
          fetchCategories(),
          fetchStoreHighlights().catch(() => null)
        ]);
        setProducts(prods);
        setCategories(cats);
        if (storeStats) setHighlights(storeStats);
      } catch (error) {
        console.error('Failed to load store data', error);
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
    if (localSearch.trim()) {
      params.set('search', localSearch.trim());
    } else {
      params.set('view', 'all');
    }
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

  const toggleBrand = (brand: string) =>
    setSelectedBrands(prev => (prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]));

  const availableBrands = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map(p => p.brand)
            .filter((b): b is string => Boolean(b) && String(b).trim() !== '')
        )
      ).sort(),
    [products]
  );

  // ============================================================================
  // CURATED FRONT PAGE COLLECTIONS (8 ITEMS PER ROW AS REQUESTED)
  // ============================================================================
  const featuredProducts = useMemo(() => {
    const inStock = products.filter(p => p.stock > 0);
    const source = inStock.length > 0 ? inStock : products;
    const explicitFeatured = source.filter(p => p.is_featured);

    if (explicitFeatured.length >= 8) {
      return explicitFeatured.slice(0, 8);
    }

    const remaining = source
      .filter(p => !p.is_featured)
      .sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0));

    return [...explicitFeatured, ...remaining].slice(0, 8);
  }, [products]);

  const newlyAddedProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return b.id - a.id;
      })
      .slice(0, 8);
  }, [products]);

  const discountedProducts = useMemo(() => {
    return products
      .filter(p => {
        const sell = Number(p.cash_discount_price || p.price || 0);
        const reg = Number(p.regular_price || 0);
        return reg > sell && sell > 0;
      })
      .sort((a, b) => {
        const sellA = Number(a.cash_discount_price || a.price || 0);
        const regA = Number(a.regular_price || 0);
        const pctA = regA > 0 ? (regA - sellA) / regA : 0;

        const sellB = Number(b.cash_discount_price || b.price || 0);
        const regB = Number(b.regular_price || 0);
        const pctB = regB > 0 ? (regB - sellB) / regB : 0;

        return pctB - pctA;
      })
      .slice(0, 8);
  }, [products]);

  // ============================================================================
  // FULL CATALOG FILTERING
  // ============================================================================
  const filteredProducts = useMemo(() => {
    const list = products.filter(p => {
      const price = Number(p.cash_discount_price || p.price || 0);
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (selectedBrands.length > 0 && (!p.brand || !selectedBrands.includes(p.brand))) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      const priceA = Number(a.cash_discount_price || a.price || 0);
      const priceB = Number(b.cash_discount_price || b.price || 0);
      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'rating') return Number(b.average_rating || 0) - Number(a.average_rating || 0);
      return b.id - a.id;
    });
  }, [products, minPrice, maxPrice, inStockOnly, selectedBrands, sortBy]);

  const isDefaultHomeView = !categoryQuery && !searchQuery && !viewAllQuery;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 font-sans w-full">
      {/* MINIMALIST DYNAMIC HEADER */}
      {isDefaultHomeView && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI-Verified Tech Storefront
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                Precision hardware, curated for performance.
              </h1>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                Explore handpicked flagship devices, latest arrivals, and verified price drops—or ask Aura AI to compare specs across our catalog.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => setCategory(null)}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold shadow-sm transition inline-flex items-center gap-2"
                >
                  Explore Full Catalog <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Live Dynamic Store Metrics */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                <span className="block text-xl sm:text-2xl font-black text-slate-900">
                  {highlights?.in_stock_products ?? products.filter(p => p.stock > 0).length}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In Stock</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                <span className="block text-xl sm:text-2xl font-black text-slate-900">
                  {categories.length}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categories</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                <span className="block text-xl sm:text-2xl font-black text-slate-900">
                  {highlights?.average_store_rating ?? '4.9'}★
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rating</span>
              </div>
            </div>
          </div>

          {/* Value Proposition Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% Authentic & Official Warranty</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Free Delivery on Orders ৳5,000+</span>
            </div>
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-slate-700 shrink-0" />
              <span>7-Day Easy Replacement Policy</span>
            </div>
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Real-Time Inventory Verification</span>
            </div>
          </div>
        </section>
      )}

      {/* CATEGORY PILLS & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 w-full">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSearchParams({})}
            className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              isDefaultHomeView
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            Home Highlights
          </button>
          <button
            onClick={() => setCategory(null)}
            className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              viewAllQuery
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            All Products ({products.length})
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                categoryQuery === c.slug
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!isDefaultHomeView && (
            <div className="relative flex items-center bg-white border border-slate-200 rounded-full px-3.5 py-2 shadow-sm">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none pr-2 cursor-pointer"
              >
                <option value="newest">Sort: Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Top Customer Rated</option>
              </select>
            </div>
          )}

          <form onSubmit={handleLocalSearchSubmit} className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search products or brands..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-semibold focus:outline-none focus:border-slate-900 transition shadow-sm"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5" />
          </form>
        </div>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="py-28 text-center text-slate-400 font-bold flex flex-col items-center justify-center space-y-3 w-full">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
          <p className="text-xs uppercase tracking-widest">Curating showcase...</p>
        </div>
      ) : isDefaultHomeView ? (
        /* ======================================================================
           DEFAULT FRONT PAGE: FEATURED, NEWLY ADDED & DISCOUNTED (8 PER ROW)
           ====================================================================== */
        <div className="space-y-14">
          {/* 1. FEATURED PRODUCTS SECTION */}
          {featuredProducts.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-end justify-between border-b border-slate-200/80 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
                    <Star className="w-3.5 h-3.5 fill-indigo-600" /> Editor's Choice
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Featured Products</h2>
                </div>
                <button
                  onClick={() => setCategory(null)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition"
                >
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6">
                {featuredProducts.map(product => (
                  <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. NEWLY ADDED ARRIVALS SECTION */}
          {newlyAddedProducts.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-end justify-between border-b border-slate-200/80 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
                    <Clock className="w-3.5 h-3.5" /> Latest Releases
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Newly Added</h2>
                </div>
                <button
                  onClick={() => {
                    setSortBy('newest');
                    setCategory(null);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition"
                >
                  See All New Arrivals <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6">
                {newlyAddedProducts.map(product => (
                  <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. SPECIAL DISCOUNTS & OFFERS SECTION */}
          {discountedProducts.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-end justify-between border-b border-slate-200/80 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-600 mb-1">
                    <Tag className="w-3.5 h-3.5" /> Limited-Time Savings
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Special Discounts</h2>
                </div>
                <button
                  onClick={() => setCategory(null)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition"
                >
                  Browse All Deals <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6">
                {discountedProducts.map(product => (
                  <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* EXPLORE COMPLETE CATALOG FOOTER CARD */}
          <section className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center shadow-sm flex flex-col items-center justify-center space-y-3">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Looking for more configurations or accessories?
            </h3>
            <p className="text-xs text-slate-500 max-w-md">
              Browse our complete inventory of {products.length} products with advanced price, brand, and availability filters.
            </p>
            <button
              onClick={() => setCategory(null)}
              className="mt-2 px-7 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold shadow-sm transition inline-flex items-center gap-2"
            >
              View All {products.length} Products <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        </div>
      ) : (
        /* ======================================================================
           FULL CATALOG VIEW WITH SIDEBAR FILTERS
           ====================================================================== */
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-600 bg-white px-5 py-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-400 uppercase tracking-wider">Showing:</span>
              {viewAllQuery && <span className="px-3 py-1 bg-slate-100 rounded-full font-bold text-slate-900">Full Catalog</span>}
              {categoryQuery && (
                <span className="px-3 py-1 bg-slate-100 rounded-full font-bold text-slate-900">
                  {categories.find(c => c.slug === categoryQuery)?.name || categoryQuery}
                </span>
              )}
              {searchQuery && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold">"{searchQuery}"</span>}
              {selectedBrands.map(b => (
                <span key={b} className="px-3 py-1 bg-slate-900 text-white rounded-full font-bold">{b}</span>
              ))}
              {inStockOnly && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold">In Stock Only</span>}
              <span className="text-slate-400 font-semibold ml-1">({filteredProducts.length} items)</span>
            </div>
            <button
              onClick={() => {
                setLocalSearch('');
                setMinPrice('');
                setMaxPrice('');
                setInStockOnly(false);
                setSelectedBrands([]);
                setSearchParams({});
              }}
              className="text-slate-600 hover:text-rose-600 px-3 py-1 rounded-full border border-slate-200 hover:border-rose-200 transition flex items-center gap-1.5 font-bold"
            >
              <XCircle className="w-3.5 h-3.5" /> Back to Home Highlights
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start w-full">
            {/* Left Filter Sidebar */}
            <aside className="lg:col-span-1 space-y-5 lg:sticky lg:top-28">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Refine Catalog
                  </h3>
                  {(minPrice || maxPrice || inStockOnly || selectedBrands.length > 0) && (
                    <button
                      onClick={() => { setMinPrice(''); setMaxPrice(''); setInStockOnly(false); setSelectedBrands([]); }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-xs text-slate-700 mb-2.5">Price Range (৳)</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={e => setMinPrice(e.target.value)}
                      className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs font-semibold focus:border-slate-900 focus:bg-white outline-none transition"
                    />
                    <span className="text-slate-300">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={e => setMaxPrice(e.target.value)}
                      className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs font-semibold focus:border-slate-900 focus:bg-white outline-none transition"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${inStockOnly ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-300 group-hover:border-slate-400'}`}>
                      {inStockOnly && <CheckSquare className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-700">Ready to Ship (In Stock)</span>
                    <input type="checkbox" className="sr-only" checked={inStockOnly} onChange={() => setInStockOnly(!inStockOnly)} />
                  </label>
                </div>

                {availableBrands.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="font-bold text-xs text-slate-700 mb-3">Brands</h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {availableBrands.map((brand, idx) => (
                        <label key={idx} className="flex items-center gap-2.5 cursor-pointer group">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedBrands.includes(brand) ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-300 group-hover:border-slate-400'}`}>
                            {selectedBrands.includes(brand) && <CheckSquare className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-xs font-medium text-slate-700 truncate">{brand}</span>
                          <input type="checkbox" className="sr-only" checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Right Product Grid */}
            <div className="lg:col-span-3 w-full">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-6 w-full">
                  {filteredProducts.map(product => (
                    <div key={product.id} onClick={() => onProductSelect(product)} className="cursor-pointer h-full w-full">
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-100 shadow-sm w-full p-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                    <Search className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-1 tracking-tight">No matching products</h3>
                  <p className="text-xs text-slate-500 mb-6 max-w-sm">Try broadening your price range, clearing brand filters, or searching a different keyword.</p>
                  <button
                    onClick={() => { setMinPrice(''); setMaxPrice(''); setInStockOnly(false); setSelectedBrands([]); setSearchParams({ view: 'all' }); }}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold shadow-sm transition"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};