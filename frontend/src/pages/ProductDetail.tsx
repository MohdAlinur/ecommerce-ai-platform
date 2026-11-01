import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Star, Lock, Truck, CheckCircle, ChevronDown, ChevronRight,
  User as UserIcon, Send, Scale, Bookmark, Search, ChevronLeft, Sparkles
} from 'lucide-react';
import api, { analyzeProductAI, fetchProducts, submitReview } from '../api';
import type { Product, AIReviewAnalysis } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useCompare } from '../context/CompareContext';

interface ProductDetailProps {
  productId?: number | string;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ productId }) => {
  const params = useParams<{ id: string }>();
  const activeId = productId || params.id;

  const { addToCart, openCart } = useCart();
  const { isSaved, toggleWishlist } = useWishlist();
  const { addToCompare } = useCompare();

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [zoomStyle, setZoomStyle] = useState({});

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'emi'>('cash');
  const [quantity, setQuantity] = useState(1);
  const [expandedSpec, setExpandedSpec] = useState<number | null>(0);

  const [aiAnalysis, setAiAnalysis] = useState<AIReviewAnalysis | null>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadData = async () => {
    if (!activeId) return;
    try {
      setLoading(true);
      const res = await api.get(`/products/${activeId}/`);
      const prod: Product = res.data;
      setProduct(prod);

      setSelectedImage(prod.image_display_url || prod.image_url || '');
      if (prod.variants && Array.isArray(prod.variants)) {
        const initialVariants: Record<string, string> = {};
        prod.variants.forEach((v: any) => {
          if (v.options && v.options.length > 0) {
            initialVariants[v.name] = v.options[0];
          }
        });
        setSelectedVariants(initialVariants);
      }

      const allProds = await fetchProducts();
      setSimilarProducts(allProds.filter((p: Product) => p.id !== Number(activeId)).slice(0, 8));
      setError(null);
    } catch {
      setError('Product not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setAiAnalysis(null);
  }, [activeId]);

  const handleAddToBag = () => {
    if (!product) return;
    addToCart(product, quantity, selectedVariants);
    openCart();
  };

  const handleAddBundle = () => {
    if (!product || similarProducts.length === 0) return;
    addToCart(product, 1, selectedVariants);
    addToCart(similarProducts[0], 1);
    openCart();
  };

  const handleRunAiAnalysis = async () => {
    if (!product) return;
    setAnalyzingAi(true);
    try {
      const res = await analyzeProductAI(product.id);
      setAiAnalysis(res);
    } catch {
      alert('Unable to run AI review analysis right now.');
    } finally {
      setAnalyzingAi(false);
    }
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
      setNewComment('');
      setReviewerName('');
      setShowReviewForm(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Please sign in to submit a product review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%`, transform: 'scale(2.2)' });
  };

  if (loading) {
    return <div className="min-h-[80vh] flex items-center justify-center font-bold text-slate-400">Loading product specifications...</div>;
  }

  if (error || !product) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 font-sans p-4 text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100 shadow-sm">
          <Search className="w-10 h-10 text-rose-500 opacity-80" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">Product Not Found</h2>
        <p className="text-slate-500 font-medium max-w-md mb-8 text-sm sm:text-base leading-relaxed">
          The item you are looking for may have been removed, sold out, or is no longer available in our catalog.
        </p>
        <Link to="/" className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-full font-bold shadow-md transition flex items-center gap-2">
          <ChevronLeft className="w-5 h-5" /> Return to Store
        </Link>
      </div>
    );
  }

  const displayPrice = Number(product.cash_discount_price || product.price || 0);
  const regularPrice = Number(product.regular_price || displayPrice);
  const emiPrice = Math.ceil(displayPrice / 12);
  const discountPercent = regularPrice > displayPrice ? Math.round(((regularPrice - displayPrice) / regularPrice) * 100) : 0;

  const allImages = [product.image_display_url || product.image_url, ...(product.image_gallery || [])].filter((img): img is string => Boolean(img));
  const keyFeatures = Array.isArray(product.key_features) ? product.key_features : [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc: number, r: any) => acc + Number(r.rating || 5), 0) / reviews.length).toFixed(1)
    : '5.0';

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter((r: any) => Number(r.rating) === star).length;
    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : (star === 5 ? 100 : 0);
    return { s: star, p: pct };
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 font-sans bg-transparent w-full overflow-x-hidden">
      {/* Breadcrumb */}
      <div className="text-xs font-semibold text-slate-400 mb-8 flex flex-wrap items-center gap-2 tracking-wide uppercase">
        <Link to="/" className="hover:text-slate-900 transition">Store</Link> <ChevronRight className="w-3 h-3 shrink-0" />
        <Link to={`/?category=${product.category_slug || product.category}`} className="hover:text-slate-900 transition">{product.category_name || 'Category'}</Link>
        {product.brand && (
          <>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <Link to={`/?search=${encodeURIComponent(product.brand)}`} className="text-slate-900 hover:underline">{product.brand}</Link>
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 mb-16 w-full">
        {/* Gallery */}
        <div className="w-full lg:w-5/12 flex flex-col-reverse md:flex-row gap-4 lg:sticky lg:top-28 self-start z-10">
          <div className="flex md:flex-col gap-3 overflow-x-auto w-full md:w-20 shrink-0 pb-2 md:pb-0">
            {allImages.map((img, idx) => (
              <button
                key={idx}
                onMouseEnter={() => setSelectedImage(img)}
                onClick={() => setSelectedImage(img)}
                className={`w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-2xl p-2 shrink-0 overflow-hidden transition-all ${
                  selectedImage === img ? 'border-slate-900 bg-white shadow-md' : 'border-transparent bg-white hover:border-slate-200'
                }`}
              >
                <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-contain mix-blend-multiply" />
              </button>
            ))}
          </div>
          <div className="w-full bg-white flex items-center justify-center relative overflow-hidden rounded-[2rem] border border-slate-100 aspect-square md:aspect-[4/5] group shadow-sm">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.name}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setZoomStyle({ transformOrigin: 'center center', transform: 'scale(1)' })}
                className="w-full h-full max-h-full md:max-h-[560px] object-contain p-8 transition-transform duration-75 ease-out cursor-crosshair mix-blend-multiply"
                style={zoomStyle}
              />
            ) : (
              <div className="text-slate-400 font-bold">No Image Available</div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="w-full lg:w-4/12 flex flex-col">
          {product.product_code && (
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">SKU: {product.product_code}</span>
          )}
          <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-3 text-slate-900 tracking-tight">{product.name}</h1>

          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-slate-900">{avgRating}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500">{reviews.length} Verified Reviews</span>
            <button
              onClick={handleRunAiAnalysis}
              disabled={analyzingAi}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {analyzingAi ? 'Analyzing...' : 'AI Review Summary'}
            </button>
          </div>

          {aiAnalysis && (
            <div className="mb-6 p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> AI Sentiment: {aiAnalysis.sentiment_label || 'Positive'}
                </span>
                {aiAnalysis.sentiment_score !== undefined && (
                  <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                    {aiAnalysis.sentiment_score}/100
                  </span>
                )}
              </div>
              <p className="text-indigo-900 leading-relaxed">{aiAnalysis.summary}</p>
            </div>
          )}

          {product.variants && Array.isArray(product.variants) && product.variants.map((v, idx) => (
            <div key={idx} className="mb-6 w-full">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                {v.name}: <span className="text-indigo-600 ml-1">{selectedVariants[v.name]}</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {v.options.map((opt: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedVariants({ ...selectedVariants, [v.name]: opt })}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                      selectedVariants[v.name] === opt
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <h3 className="font-bold text-slate-900 mb-3 tracking-tight text-sm uppercase">Key Highlights</h3>
          <ul className="space-y-2.5 text-sm text-slate-600 mb-6">
            {keyFeatures.length > 0 ? keyFeatures.map((feat, idx) => (
              <li key={idx} className="flex gap-2.5 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0"></span>
                <span>{typeof feat === 'string' ? feat : JSON.stringify(feat)}</span>
              </li>
            )) : <li className="text-slate-400 italic">Standard manufacturer specifications apply.</li>}
          </ul>

          <div
            onClick={() => document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer flex items-center gap-1 w-max transition"
          >
            <ChevronDown className="w-4 h-4 shrink-0" /> Jump to full technical specifications
          </div>
        </div>

        {/* Buy Box */}
        <div className="w-full lg:w-3/12">
          <div className="border border-slate-200/80 rounded-3xl p-6 bg-white shadow-sm lg:sticky lg:top-28">
            <div className="mb-5">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                ৳{paymentMethod === 'emi' ? `${emiPrice.toLocaleString()}/mo` : displayPrice.toLocaleString()}
              </span>
              {discountPercent > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-md">Save {discountPercent}%</span>
                  <span className="text-xs text-slate-400 line-through font-medium">৳{regularPrice.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 mb-5">
              <label className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition ${paymentMethod === 'cash' ? 'bg-slate-50 border-slate-900' : 'border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" name="payment" value="cash" className="mt-1 accent-slate-900" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                <div>
                  <div className="font-bold text-xs text-slate-900">Cash Discount Price</div>
                  <div className="text-slate-500 font-medium text-[11px] mt-0.5">Card, bKash, Nagad, or COD</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition ${paymentMethod === 'emi' ? 'bg-slate-50 border-slate-900' : 'border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" name="payment" value="emi" className="mt-1 accent-slate-900" checked={paymentMethod === 'emi'} onChange={() => setPaymentMethod('emi')} />
                <div>
                  <div className="font-bold text-xs text-slate-900">12-Month 0% EMI Plan</div>
                  <div className="text-indigo-600 font-semibold text-[11px] mt-0.5">৳{emiPrice.toLocaleString()} / month</div>
                </div>
              </label>
            </div>

            <div className="space-y-3 mb-5 text-xs">
              <div className="flex gap-2.5 items-center text-slate-600 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <Truck className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{displayPrice >= 5000 ? 'Eligible for FREE Delivery' : 'Standard Nationwide Delivery'}</span>
              </div>
              <div className={`font-bold text-sm ${product.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Currently Out of Stock'}
              </div>
            </div>

            {product.stock > 0 && (
              <div className="space-y-3 border-b border-slate-100 pb-5 mb-5">
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 bg-white w-full cursor-pointer"
                >
                  {[...Array(Math.min(10, product.stock))].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Quantity: {i + 1}</option>
                  ))}
                </select>

                <button
                  onClick={handleAddToBag}
                  className="w-full bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 py-3 rounded-full text-xs font-bold transition"
                >
                  Add to Shopping Bag
                </button>
                <button
                  onClick={handleAddToBag}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-full text-xs font-bold shadow-md transition"
                >
                  Buy Now
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 justify-center mb-4">
              <Lock className="w-3.5 h-3.5 shrink-0" /> PCI-DSS Encrypted Checkout
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => toggleWishlist(product)}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 py-2.5 rounded-xl transition"
              >
                <Bookmark className={`w-3.5 h-3.5 ${isSaved(product.id) ? 'fill-current text-rose-500' : ''}`} />
                {isSaved(product.id) ? 'Saved' : 'Wishlist'}
              </button>
              <button
                onClick={() => addToCompare(product)}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 py-2.5 rounded-xl transition"
              >
                <Scale className="w-3.5 h-3.5" /> Compare
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together */}
      {similarProducts.length > 0 && (
        <div className="mb-16 max-w-6xl mx-auto">
          <h2 className="text-xl font-black text-slate-900 tracking-tight mb-6">Frequently Bought Together</h2>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 shrink-0">
              <div className="relative bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <img src={selectedImage} alt={product.name} className="w-20 h-20 object-contain mix-blend-multiply" />
              </div>
              <span className="text-2xl text-slate-300 font-light">+</span>
              <div className="relative bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <img src={similarProducts[0].image_display_url || similarProducts[0].image_url} alt={similarProducts[0].name} className="w-20 h-20 object-contain mix-blend-multiply" />
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-xs font-bold text-slate-700">
                {product.name} + {similarProducts[0].name}
              </p>
              <div className="text-slate-500 text-xs font-medium">
                Bundle Total:{' '}
                <span className="text-slate-900 font-black text-xl ml-1">
                  ৳{(displayPrice + Number(similarProducts[0].cash_discount_price || similarProducts[0].price || 0)).toLocaleString()}
                </span>
              </div>
            </div>
            <button
              onClick={handleAddBundle}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-full text-xs font-bold shadow-sm transition w-full md:w-auto"
            >
              Add Both to Bag
            </button>
          </div>
        </div>
      )}

      {/* Technical Specifications */}
      <div id="details-section" className="scroll-mt-28"></div>
      {specifications.length > 0 && (
        <div className="mb-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-6 text-center">Technical Specifications</h2>
          <div className="rounded-3xl border border-slate-200/80 overflow-hidden bg-white shadow-sm">
            {specifications.map((group: any, idx: number) => (
              <div key={idx} className="border-b border-slate-100 last:border-0">
                <button
                  onClick={() => setExpandedSpec(expandedSpec === idx ? null : idx)}
                  className="w-full p-5 flex justify-between items-center transition bg-slate-50/50 hover:bg-slate-50 text-left"
                >
                  <span className="font-bold text-slate-900 text-sm tracking-tight">{group.groupName || group.group}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedSpec === idx ? 'rotate-180' : ''}`} />
                </button>
                {expandedSpec === idx && (
                  <div className="bg-white px-5 pb-5">
                    <div className="divide-y divide-slate-100 border-t border-slate-100 pt-3">
                      {(group.features || group.attributes)?.map((f: any, fIdx: number) => (
                        <div key={fIdx} className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-8 text-xs">
                          <span className="font-bold text-slate-900 sm:w-1/3">{f.key || f.name}</span>
                          <span className="text-slate-600 sm:w-2/3 leading-relaxed whitespace-pre-line">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Overview */}
      <div className="mb-16 max-w-4xl mx-auto bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-black tracking-tight text-slate-900 mb-4">Product Overview</h2>
        <div
          className="text-sm text-slate-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: (product.description || '').replace(/\n/g, '<br/>') }}
        />
      </div>

      {/* Customer Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16 max-w-6xl mx-auto">
        <div className="lg:col-span-4">
          <h2 className="text-xl font-black tracking-tight text-slate-900 mb-4">Customer Reviews</h2>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1 rounded-full">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="font-bold text-xs">{avgRating}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500">Based on {reviews.length} reviews</span>
          </div>

          <div className="space-y-2.5 mb-8">
            {ratingBreakdown.map(bar => (
              <div key={bar.s} className="flex items-center gap-3 text-xs font-medium text-slate-600">
                <span className="w-10">{bar.s} star</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-slate-900 rounded-full" style={{ width: `${bar.p}%` }}></div>
                </div>
                <span className="w-8 text-right text-slate-400">{bar.p}%</span>
              </div>
            ))}
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 space-y-3 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm">Review this product</h3>
            <p className="text-xs text-slate-500">Share your experience with other shoppers.</p>
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-slate-800 transition"
            >
              {showReviewForm ? 'Cancel' : 'Write a Review'}
            </button>

            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} className="pt-4 border-t border-slate-100 space-y-3">
                <input
                  type="text"
                  required
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs focus:border-slate-900 outline-none"
                />
                <select
                  value={newRating}
                  onChange={e => setNewRating(Number(e.target.value))}
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-white font-bold text-slate-900 outline-none"
                >
                  <option value={5}>★★★★★ (5 - Excellent)</option>
                  <option value={4}>★★★★☆ (4 - Good)</option>
                  <option value={3}>★★★☆☆ (3 - Average)</option>
                  <option value={2}>★★☆☆☆ (2 - Poor)</option>
                  <option value={1}>★☆☆☆☆ (1 - Terrible)</option>
                </select>
                <textarea
                  rows={3}
                  required
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Write your feedback..."
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs focus:border-slate-900 outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <h3 className="font-black text-slate-900 text-lg mb-6">Verified Buyer Feedback</h3>
          {reviews.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
              <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-xs font-semibold">No verified reviews yet. Be the first to review this product!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev: any, idx: number) => (
                <div key={idx} className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{rev.user_name}</span>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Verified Purchase
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold text-slate-900">{rev.rating}</span>
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">"{rev.comment}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};