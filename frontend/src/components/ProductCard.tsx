import React, { useState, useRef } from 'react';
import { Sparkles, Plus, Bookmark, Scale, Star, Check } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useCompare } from '../context/CompareContext';
import { analyzeProductAI } from '../api';

// Client-side memory cache so clicking AI Insight on the same product never wastes tokens
const productAiSummaryCache = new Map<number, string>();

interface ProductCardProps {
  product: Product;
  onRefresh?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { isSaved, toggleWishlist } = useWishlist();
  const { addToCompare, compareItems } = useCompare();

  const [analyzing, setAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const fetchingLockRef = useRef(false);

  const rawPrice = product.cash_discount_price ?? product.price ?? 0;
  const priceNum = Number(rawPrice);
  const regularNum = Number(product.regular_price ?? 0);
  const displayPrice = isNaN(priceNum) ? '0' : priceNum.toLocaleString();
  const discountPercent = regularNum > priceNum && priceNum > 0
    ? Math.round(((regularNum - priceNum) / regularNum) * 100)
    : 0;

  const handleAiAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Toggle off if already visible
    if (aiSummary) {
      setAiSummary(null);
      return;
    }

    // Return instantly from client cache if previously analyzed in this session (0 tokens)
    const cached = productAiSummaryCache.get(product.id);
    if (cached) {
      setAiSummary(cached);
      return;
    }

    // Synchronous lock against accidental double-clicks
    if (fetchingLockRef.current || analyzing) return;
    fetchingLockRef.current = true;

    try {
      setAnalyzing(true);
      const data = await analyzeProductAI(product.id);
      const summaryText = data.summary || 'No summary available.';
      productAiSummaryCache.set(product.id, summaryText);
      setAiSummary(summaryText);
    } catch {
      alert('Failed to generate AI summary.');
    } finally {
      setAnalyzing(false);
      fetchingLockRef.current = false;
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCompare(product);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    addToCart(product, 1);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1200);
  };

  const saved = isSaved(product.id);
  const inCompare = compareItems.some(i => i.id === product.id);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200 hover:-translate-y-1 transition-all duration-300 p-4 flex flex-col justify-between relative overflow-hidden group h-full">
      <div className="flex justify-between items-center gap-2 mb-3">
        <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider truncate max-w-[65%]">
          {product.brand || product.category_name || 'AuraTech'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {discountPercent > 0 && product.stock > 0 && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full">
              -{discountPercent}%
            </span>
          )}
          {product.stock === 0 ? (
            <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2.5 py-1 rounded-full">Sold Out</span>
          ) : product.stock <= 5 ? (
            <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-full">{product.stock} left</span>
          ) : null}
        </div>
      </div>

      <div className="w-full aspect-square bg-slate-50/60 rounded-2xl flex items-center justify-center p-6 mb-4 relative group-hover:bg-slate-50 transition-colors">
        <button
          onClick={(e) => { e.stopPropagation(); toggleWishlist(product); }}
          aria-label="Save to wishlist"
          className={`absolute top-3 right-3 p-2.5 rounded-full shadow-sm bg-white hover:bg-slate-50 transition z-10 border border-slate-100 ${saved ? 'text-rose-500' : 'text-slate-400 hover:text-slate-700'}`}
        >
          <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
        </button>

        <button
          onClick={handleCompare}
          title="Compare Product"
          className={`absolute top-14 right-3 p-2.5 rounded-full shadow-sm bg-white hover:bg-slate-50 border border-slate-100 transition z-10 ${
            inCompare
              ? 'text-indigo-600 opacity-100'
              : 'text-slate-400 hover:text-indigo-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:translate-x-2 sm:group-hover:translate-x-0'
          } duration-200`}
        >
          <Scale className="w-4 h-4" />
        </button>

        <img
          src={product.image_display_url || product.image_url || 'https://via.placeholder.com/300'}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
        />
      </div>

      <div className="space-y-1.5 mb-4 flex-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
          <span className="truncate">{product.category_name || 'Catalog'}</span>
          {Number(product.average_rating) > 0 && (
            <span className="flex items-center gap-1 text-slate-700 font-bold shrink-0">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {product.average_rating}
            </span>
          )}
        </div>
        <h3 className="font-bold text-slate-900 text-base line-clamp-1 tracking-tight group-hover:text-indigo-600 transition-colors">
          {product.name}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {product.description?.replace(/<[^>]*>?/gm, '')}
        </p>
      </div>

      {aiSummary && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-4 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs text-indigo-950 leading-relaxed"
        >
          <span className="font-bold mb-1 flex items-center gap-1 text-indigo-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Review Insight
          </span>
          {aiSummary}
        </div>
      )}

      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between mt-auto gap-2">
        <div className="min-w-0">
          <span className="text-lg font-black text-slate-900 tracking-tight block leading-none">
            ৳{displayPrice}
          </span>
          {regularNum > priceNum && (
            <span className="text-[11px] text-slate-400 line-through font-medium">
              ৳{regularNum.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleAiAnalysis}
            disabled={analyzing}
            title="AI Review Summary"
            className={`p-2.5 rounded-full transition disabled:opacity-50 ${
              aiSummary ? 'bg-indigo-600 text-white' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleAdd}
            disabled={product.stock <= 0}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold shadow-sm transition ${
              addedFeedback
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white'
            }`}
          >
            {addedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5" /> Added
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> {product.stock > 0 ? 'Add' : 'Sold'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};