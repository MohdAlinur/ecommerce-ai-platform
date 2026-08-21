import React, { useState } from 'react';
import { Star, Sparkles, Plus, Bookmark } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { analyzeProductAI } from '../api';

interface ProductCardProps {
  product: Product;
  onRefresh?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { isSaved, toggleWishlist } = useWishlist();
  
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

  const saved = isSaved(product.id);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition p-4 flex flex-col justify-between relative overflow-hidden group h-full">
      <div className="flex justify-between items-center mb-3">
        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold uppercase tracking-wide">{product.category_name || 'General'}</span>
        {product.stock <= 2 && <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">Low Stock</span>}
      </div>

      <div className="w-full h-48 bg-slate-50 rounded-xl flex items-center justify-center p-3 mb-4 overflow-hidden border border-slate-100 relative">
        <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product); }} className={`absolute top-2 right-2 p-2 rounded-full shadow-sm bg-white hover:bg-slate-50 transition z-10 ${saved ? 'text-indigo-600' : 'text-slate-400'}`}>
          <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
        </button>
        <img src={product.image_display_url || product.image_url || 'https://via.placeholder.com/300'} alt={product.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300" />
      </div>

      <div className="space-y-1 mb-4 flex-1">
        <h3 className="font-extrabold text-slate-900 text-base line-clamp-1">{product.name}</h3>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{product.description}</p>
      </div>

      {aiSummary && (
        <div className="mb-3 p-2.5 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-900">
          <span className="font-bold block mb-0.5 flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-600"/> AI Insight:</span>{aiSummary}
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Price</span>
          <span className="text-lg font-black text-[#ef4a23]">৳{displayPrice}</span>
          <span className="text-[11px] text-slate-500 block font-medium mt-0.5">{product.stock} in stock</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleAiAnalysis} className="p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition"><Sparkles className="w-4 h-4"/></button>
          <button onClick={(e) => { e.stopPropagation(); addToCart(product); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
            <Plus className="w-3.5 h-3.5"/> Add
          </button>
        </div>
      </div>
    </div>
  );
};