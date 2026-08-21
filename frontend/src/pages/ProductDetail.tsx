import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Home, Star, Share2, Bookmark, CheckSquare, Sparkles, MessageSquare, Send } from 'lucide-react';
import { analyzeProductAI, fetchProducts, submitReview } from '../api';
import type { Product, AIReviewAnalysis } from '../types';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

interface ProductDetailProps {
  productId?: number | string;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ productId }) => {
  const params = useParams<{ id: string }>();
  const activeId = productId || params.id;
  const navigate = useNavigate();
  
  const { addToCart, openCart } = useCart();
  const { isSaved, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'specs' | 'desc' | 'reviews'>('specs');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'emi'>('cash');
  const [quantity, setQuantity] = useState(1);

  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadData = async () => {
    if (!activeId) return;
    try {
      setLoading(true);
      const res = await axios.get(`http://127.0.0.1:8000/api/products/${activeId}/`, { withCredentials: true });
      setProduct(res.data);
      const allProds = await fetchProducts();
      setSimilarProducts(allProds.filter(p => p.id !== Number(activeId)).slice(0, 4));
    } catch (err) {
      console.error("Failed to fetch product:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeId]);

  const handleBuyNow = () => {
    addToCart(product!, quantity);
    openCart(); 
  };

  const scrollToSpecs = () => {
    setActiveTab('specs');
    document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !reviewerName.trim()) {
      alert('Please fill in your name and comment.');
      return;
    }
    setSubmittingReview(true);
    try {
      await submitReview({
        product: product?.id,
        user_name: reviewerName,
        rating: newRating,
        comment: newComment
      });
      alert('Review submitted successfully!');
      setNewComment('');
      setReviewerName('');
      loadData();
    } catch (err) {
      alert('Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <div className="p-20 text-center text-slate-500 font-bold">Loading product details...</div>;
  if (!product) return <div className="p-20 text-center font-bold text-rose-600">Product not found.</div>;

  const displayPrice = Number(product.cash_discount_price || product.price || 0);
  const regularPrice = Number(product.regular_price || displayPrice * 1.1);
  const emiPrice = Math.ceil(regularPrice / 12);
  const keyFeatures = Array.isArray(product.key_features) ? product.key_features : [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  
  const saved = isSaved(product.id);
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm mb-6 pb-4 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-2 text-slate-500 font-medium whitespace-nowrap overflow-x-auto w-full">
          <Link to="/" className="hover:text-[#3749bb] flex items-center"><Home className="w-4 h-4"/></Link>
          <span>/</span>
          <Link to={`/?category=${product.category_name}`} className="hover:text-[#3749bb]">{product.category_name || 'Category'}</Link>
          <span>/</span>
          <Link to={`/?search=${product.brand}`} className="text-slate-800 hover:text-[#3749bb] font-bold">{product.brand || 'Brand'}</Link>
          <span>/</span>
          <span className="text-slate-800 truncate">{product.name}</span>
        </div>
        
        <div className="flex items-center gap-6 text-slate-600 font-semibold shrink-0">
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); }} className="flex items-center gap-2 hover:text-[#3749bb]"><Share2 className="w-4 h-4"/> Share</button>
          <button onClick={() => toggleWishlist(product)} className={`flex items-center gap-2 hover:text-[#3749bb] transition ${saved ? 'text-[#3749bb] font-bold' : ''}`}>
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`}/> {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-10">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center h-[400px]">
            <img src={product.image_display_url || product.image_url} alt={product.name} className="max-h-full object-contain" />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <h1 className="text-2xl font-bold text-[#111827] leading-snug">{product.name}</h1>
          
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <span className="bg-white border px-3 py-1.5 rounded-full text-slate-700">Price: <strong className="text-slate-900">৳{displayPrice.toLocaleString()}</strong></span>
            <span className="bg-white border px-3 py-1.5 rounded-full text-slate-700">Regular Price: <strong className="text-slate-900">৳{regularPrice.toLocaleString()}</strong></span>
            <span className="bg-white border px-3 py-1.5 rounded-full text-slate-700">Status: <strong className="text-emerald-600">In Stock</strong></span>
            <span className="bg-white border px-3 py-1.5 rounded-full text-slate-700">Product Code: <strong className="text-slate-900">{product.product_code || product.id}</strong></span>
            <span className="bg-white border px-3 py-1.5 rounded-full text-slate-700">Brand: <strong className="text-slate-900">{product.brand || 'N/A'}</strong></span>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-lg">Key Features</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {keyFeatures.length > 0 ? keyFeatures.map((feat, idx) => (
                <li key={idx} className="flex gap-2 items-start"><span className="text-slate-400 mt-1">•</span>{typeof feat === 'string' ? feat : JSON.stringify(feat)}</li>
              )) : <li>No key features specified.</li>}
            </ul>
            <button onClick={scrollToSpecs} className="text-[#ef4a23] hover:underline text-sm font-bold mt-2 inline-block">View More Info</button>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-bold text-slate-900 text-lg">Payment Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`relative flex cursor-pointer rounded-xl border bg-white p-4 shadow-sm focus:outline-none ${paymentMethod === 'cash' ? 'border-[#3749bb] ring-1 ring-[#3749bb]' : 'border-slate-300'}`}>
                <input type="radio" name="payment" value="cash" className="sr-only" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                <span className="flex flex-1 flex-col">
                  <span className="block text-xl font-black text-slate-900">৳{displayPrice.toLocaleString()}</span>
                  <span className="mt-1 flex items-center text-sm font-semibold text-slate-500">Cash Discount Price</span>
                </span>
                <CheckSquare className={`h-5 w-5 ${paymentMethod === 'cash' ? 'text-[#3749bb]' : 'invisible'}`} />
              </label>

              <label className={`relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none ${paymentMethod === 'emi' ? 'border-[#3749bb] ring-1 ring-[#3749bb]' : 'border-slate-300'}`}>
                <input type="radio" name="payment" value="emi" className="sr-only" checked={paymentMethod === 'emi'} onChange={() => setPaymentMethod('emi')} />
                <span className="flex flex-1 flex-col">
                  <span className="block text-xl font-black text-slate-900">৳{emiPrice.toLocaleString()}/month</span>
                  <span className="mt-1 flex items-center text-sm font-semibold text-slate-500">Regular Price: ৳{regularPrice.toLocaleString()}</span>
                </span>
                <CheckSquare className={`h-5 w-5 ${paymentMethod === 'emi' ? 'text-[#3749bb]' : 'invisible'}`} />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-sm">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-3 text-lg font-bold hover:bg-slate-100 transition">-</button>
              <div className="w-12 text-center font-bold border-x py-3">{quantity}</div>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-3 text-lg font-bold hover:bg-slate-100 transition">+</button>
            </div>
            <button onClick={handleBuyNow} className="flex-1 bg-[#3749bb] hover:bg-indigo-900 text-white py-4 rounded-xl font-bold text-lg transition shadow-md">
              Buy Now
            </button>
          </div>
        </div>
      </div>

      <div id="details-section" className="grid grid-cols-1 lg:grid-cols-4 gap-8 scroll-mt-32">
        <div className="lg:col-span-3">
          <div className="flex flex-wrap gap-2 mb-6 sticky top-[120px] z-30 bg-[#f2f4f8] py-2">
            {[
              { id: 'specs', label: 'Specification' },
              { id: 'desc', label: 'Description' },
              { id: 'reviews', label: `Reviews (${reviews.length})` }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 rounded-xl text-sm font-bold border transition shadow-sm ${activeTab === tab.id ? 'bg-[#ef4a23] text-white border-[#ef4a23]' : 'bg-white text-slate-700 hover:text-[#ef4a23]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            {activeTab === 'specs' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Specification</h2>
                <div className="space-y-6">
                  {specifications.length > 0 ? specifications.map((group: any, idx: number) => (
                    <div key={idx} className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200"><h3 className="font-bold text-[#3749bb]">{group.groupName || group.group}</h3></div>
                      <div className="divide-y divide-slate-100 text-sm">
                        {(group.features || group.attributes)?.map((f: any, fIdx: number) => (
                          <div key={fIdx} className="flex flex-col sm:flex-row hover:bg-slate-50 transition">
                            <div className="sm:w-1/3 px-4 py-3 font-semibold text-slate-600 bg-slate-50/50">{f.key || f.name}</div>
                            <div className="sm:w-2/3 px-4 py-3 text-slate-900">{f.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : <p className="text-slate-500">No specifications.</p>}
                </div>
              </div>
            )}

            {activeTab === 'desc' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Description</h2>
                  <h3 className="text-lg font-bold text-[#3749bb] mb-4">{product.name}</h3>
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{product.description}</p>
                </div>

                <div className="pt-6 border-t border-slate-200 space-y-3">
                  <h3 className="text-lg font-black text-slate-900">Buy {product.name} From AuraTech</h3>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    In Bangladesh, you can get original <strong className="text-slate-900">{product.name}</strong> From AuraTech. We have a large collection of latest <strong className="text-slate-900">{product.brand || product.category_name}</strong> to purchase. Order Online Or Visit your Nearest AuraTech Shop to get yours at lowest price. The <strong className="text-slate-900">{product.name}</strong> comes with no warranty.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Customer Reviews & Comments</h2>

                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <p className="text-slate-500 italic">No reviews yet. Be the first to review this product!</p>
                  ) : (
                    reviews.map((rev: any, idx: number) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">{rev.user_name}</span>
                          <div className="flex items-center gap-1 text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < rev.rating ? 'fill-current' : 'text-slate-300'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-slate-700">{rev.comment}</p>
                        <span className="text-[10px] text-slate-400 block">{new Date(rev.created_at).toLocaleDateString()}</span>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleReviewSubmit} className="pt-6 border-t border-slate-200 space-y-4">
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#3749bb]" /> Write a Review
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Name</label>
                      <input 
                        type="text" 
                        required 
                        value={reviewerName} 
                        onChange={e => setReviewerName(e.target.value)} 
                        placeholder="Enter your name" 
                        className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rating</label>
                      <select 
                        value={newRating} 
                        onChange={e => setNewRating(Number(e.target.value))} 
                        className="w-full border border-slate-300 p-3 rounded-xl text-sm bg-white focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none font-bold text-amber-600"
                      >
                        <option value={5}>★★★★★ (5 Stars - Excellent)</option>
                        <option value={4}>★★★★☆ (4 Stars - Good)</option>
                        <option value={3}>★★★☆☆ (3 Stars - Average)</option>
                        <option value={2}>★★☆☆☆ (2 Stars - Poor)</option>
                        <option value={1}>★☆☆☆☆ (1 Star - Terrible)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Comment</label>
                    <textarea 
                      rows={4} 
                      required 
                      value={newComment} 
                      onChange={e => setNewComment(e.target.value)} 
                      placeholder="Write your thoughts about this product..." 
                      className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none" 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={submittingReview} 
                    className="px-6 py-3 bg-[#3749bb] hover:bg-indigo-900 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-70"
                  >
                    <Send className="w-4 h-4" /> {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4 hidden lg:block">
          <h3 className="font-bold text-center text-[#3749bb] text-lg bg-white py-3 rounded-xl shadow-sm border border-slate-200">Similar Product</h3>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-6">
            {similarProducts.map((sp) => (
              <div key={sp.id} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <Link to={`/product/${sp.id}`} className="w-20 h-20 shrink-0 bg-slate-50 rounded-xl border p-1 flex items-center justify-center">
                  <img src={sp.image_display_url || sp.image_url} alt={sp.name} className="max-h-full max-w-full object-contain" />
                </Link>
                <div className="flex flex-col justify-center">
                  <Link to={`/product/${sp.id}`} className="text-sm font-bold text-slate-800 hover:text-[#ef4a23] line-clamp-2 transition mb-1">{sp.name}</Link>
                  <div className="text-[#ef4a23] font-black text-sm mb-1">৳{Number(sp.cash_discount_price || sp.price).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};