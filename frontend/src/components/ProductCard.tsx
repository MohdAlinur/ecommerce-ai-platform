import React, { useState } from 'react';
import { Star, Sparkles, Plus, Bookmark, Scale } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useCompare } from '../context/CompareContext';
import { analyzeProductAI } from '../api';

interface ProductCardProps {
  product: Product;
  onRefresh?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { isSaved, toggleWishlist } = useWishlist();
  const { addToCompare } = useCompare(); 
  
  const [analyzing, setAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const rawPrice = product.cash_discount_price ?? product.price ?? 0;
  const priceNum = Number(rawPrice);
  const displayPrice = isNaN(priceNum) ? '0' : priceNum.toLocaleString();

  const handleAiAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setAnalyzing(true);
      const data = await analyzeProductAI(product.id);
      setAiSummary(data.summary);
    } catch (err) {
      alert('Failed to generate AI summary.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCompare(product);
  };

  const saved = isSaved(product.id);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-4 flex flex-col justify-between relative overflow-hidden group h-full">
      <div className="flex justify-between items-center mb-3">
        <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wider">{product.category_name || 'General'}</span>
        {product.stock <= 2 && <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-3 py-1 rounded-full">Low Stock</span>}
      </div>

      <div className="w-full aspect-square bg-slate-50/50 rounded-2xl flex items-center justify-center p-6 mb-5 relative group-hover:bg-slate-50 transition-colors">
        <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product); }} className={`absolute top-3 right-3 p-2.5 rounded-full shadow-sm bg-white hover:bg-slate-50 transition z-10 border border-slate-100 ${saved ? 'text-indigo-600' : 'text-slate-400'}`}>
          <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
        </button>
        
        <button onClick={handleCompare} title="Compare Product" className="absolute top-14 right-3 p-2.5 rounded-full shadow-sm bg-white hover:bg-slate-50 border border-slate-100 text-slate-400 hover:text-indigo-600 transition z-10 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 duration-300">
          <Scale className="w-4 h-4" />
        </button>

        <img src={product.image_display_url || product.image_url || 'https://via.placeholder.com/300'} alt={product.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply" />
      </div>

      <div className="space-y-1 mb-4 flex-1">
        <h3 className="font-bold text-slate-900 text-base line-clamp-1 tracking-tight">{product.name}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{product.description}</p>
      </div>

      {aiSummary && (
        <div className="mb-4 p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl text-xs text-indigo-900 leading-relaxed">
          <span className="font-bold block mb-1 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-indigo-600"/> AI Insight</span>{aiSummary}
        </div>
      )}

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
        <div>
          <span className="text-lg font-black text-slate-900 tracking-tight">৳{displayPrice}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAiAnalysis} disabled={analyzing} className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition disabled:opacity-50">
            <Sparkles className="w-4 h-4"/>
          </button>
          <button onClick={(e) => { e.stopPropagation(); addToCart(product); }} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-full text-sm font-bold shadow-sm transition">
            <Plus className="w-4 h-4"/> Add
          </button>
        </div>
      </div>
    </div>
  );
};