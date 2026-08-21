import React, { useEffect, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import type { Product, Category } from '../types';
import { fetchProducts, fetchCategories } from '../api';
import { ProductCard } from '../components/ProductCard';

interface StorePageProps {
  onProductSelect: (product: Product) => void;
}

export const StorePage: React.FC<StorePageProps> = ({ onProductSelect }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        fetchProducts(selectedCategory || undefined, searchTerm || undefined),
        fetchCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl mb-10 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4 text-purple-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Driven E-Commerce Experience</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
            Next-Gen Shopping With Instant AI Reviews
          </h2>
          <p className="text-indigo-200 text-base sm:text-lg mb-6 leading-relaxed">
            Explore premium products backed by Gemini AI review summaries and 24/7 intelligent customer assistance.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
              selectedCategory === ''
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.slug
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </form>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading catalog...</div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-slate-500">No products found. Add products via the Admin Dashboard!</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div 
              key={product.id} 
              className="cursor-pointer transition hover:-translate-y-1" 
              onClick={() => onProductSelect(product)}
            >
              <ProductCard product={product} onRefresh={loadData} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};