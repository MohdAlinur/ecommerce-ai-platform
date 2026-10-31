import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, MapPin, Lock, ShieldCheck, RefreshCcw, Truck, Award, CheckCircle, ChevronDown, ChevronRight, User as UserIcon, Send, Scale, Bookmark, Search, ChevronLeft } from 'lucide-react';
import { analyzeProductAI, fetchProducts, submitReview } from '../api';
import type { Product } from '../types';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useCompare } from '../context/CompareContext';

interface ProductDetailProps {
  productId?: number | string;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ productId }) => {
  const params = useParams<{ id: string }>();
  const activeId = productId || params.id;
  const navigate = useNavigate();
  
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

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadData = async () => {
    if (!activeId) return;
    try {
      setLoading(true);
      const res = await axios.get(`http://127.0.0.1:8000/api/products/${activeId}/`, { withCredentials: true });
      const prod = res.data;
      setProduct(prod);
      
      setSelectedImage(prod.image_display_url || prod.image_url);
      if (prod.variants && Array.isArray(prod.variants)) {
        const initialVariants: Record<string, string> = {};
        prod.variants.forEach((v: any) => { initialVariants[v.name] = v.options[0]; });
        setSelectedVariants(initialVariants);
      }

      const allProds = await fetchProducts();
      setSimilarProducts(allProds.filter((p: Product) => p.id !== Number(activeId)).slice(0, 8));
    } catch (err) {
      setError("Product not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeId]);

  const handleBuyNow = () => {
    for(let i = 0; i < quantity; i++) { addToCart(product!, 1); }
    openCart(); 
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !reviewerName.trim()) { alert('Please fill in your name and comment.'); return; }
    setSubmittingReview(true);
    try {
      await submitReview({ product: product?.id, user_name: reviewerName, rating: newRating, comment: newComment });
      setNewComment(''); setReviewerName(''); setShowReviewForm(false); loadData();
    } catch (err) { alert('Failed to submit review.'); } finally { setSubmittingReview(false); }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - left) / width * 100;
    const y = (e.clientY - top) / height * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%`, transform: 'scale(2.5)' });
  };

  if (loading) return <div className="min-h-[85vh] flex items-center justify-center font-bold text-slate-400">Loading premium details...</div>;
  
  // NEW FEATURE: Professional 404 Fallback UI
  if (error || !product) return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center bg-slate-50 font-sans p-4 text-center">
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

  const displayPrice = Number(product.cash_discount_price || product.price || 0);
  const regularPrice = Number(product.regular_price || displayPrice * 1.25);
  const emiPrice = Math.ceil(regularPrice / 12);
  const discountPercent = regularPrice > displayPrice ? Math.round(((regularPrice - displayPrice) / regularPrice) * 100) : 0;

  const allImages = [product.image_display_url || product.image_url, ...(product.image_gallery || [])].filter(Boolean);
  const keyFeatures = Array.isArray(product.key_features) ? product.key_features : [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  
  const avgRating = reviews.length > 0 ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 font-sans bg-transparent w-full overflow-x-hidden">
      
      <div className="text-xs font-semibold text-slate-400 mb-8 flex flex-wrap items-center gap-2 tracking-wide uppercase">
        <Link to="/" className="hover:text-slate-900 transition">Store</Link> <ChevronRight className="w-3 h-3 shrink-0"/>
        <Link to={`/?category=${product.category_slug || product.category}`} className="hover:text-slate-900 transition break-all line-clamp-1">{product.category_name || 'Category'}</Link> <ChevronRight className="w-3 h-3 shrink-0"/>
        <Link to={`/?search=${product.brand}`} className="text-slate-900 break-all line-clamp-1 hover:underline">{product.brand || 'Brand'}</Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 mb-16 w-full">
        
        <div className="w-full lg:w-5/12 flex flex-col-reverse md:flex-row gap-4 lg:sticky lg:top-28 self-start z-10">
          <div className="flex md:flex-col gap-3 overflow-x-auto w-full md:w-20 shrink-0 no-scrollbar pb-2 md:pb-0">
            {allImages.map((img, idx) => (
              <button 
                key={idx} onMouseEnter={() => setSelectedImage(img)} onClick={() => setSelectedImage(img)}
                className={`w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-2xl p-2 shrink-0 overflow-hidden transition-all ${selectedImage === img ? 'border-slate-900 bg-white shadow-md' : 'border-transparent bg-slate-50 hover:bg-slate-100 hover:border-slate-200'}`}
              >
                <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-contain mix-blend-multiply" />
              </button>
            ))}
          </div>
          <div className="w-full bg-slate-50/50 flex items-center justify-center relative overflow-hidden rounded-[2rem] border border-slate-100 aspect-square md:aspect-[4/5] group">
            {selectedImage ? (
              <img 
                src={selectedImage} alt={product.name} 
                onMouseMove={handleMouseMove} onMouseLeave={() => setZoomStyle({ transformOrigin: 'center center', transform: 'scale(1)' })}
                className="w-full h-full max-h-full md:max-h-[600px] object-contain p-8 transition-transform duration-75 ease-out cursor-crosshair mix-blend-multiply drop-shadow-xl group-hover:opacity-95"
                style={zoomStyle}
              />
            ) : (
              <div className="text-slate-400 font-bold">No Image Available</div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-4/12 flex flex-col overflow-hidden max-w-full">
          <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-3 text-slate-900 tracking-tight break-words">{product.name}</h1>
          <p className="text-base text-slate-500 mb-6 leading-relaxed">{product.description}</p>
          
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-100">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-200">
              <Star className="w-4 h-4 fill-slate-900 text-slate-900" />
              <span className="text-sm font-bold text-slate-900">{avgRating}</span>
            </div>
            <span className="text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer transition">{reviews.length} Verified Reviews</span>
            <span className="text-sm font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md ml-auto hidden sm:block">100+ bought this month</span>
          </div>

          {product.variants && Array.isArray(product.variants) && product.variants.map((v, idx) => (
            <div key={idx} className="mb-8 w-full">
              <h4 className="text-sm font-bold text-slate-900 mb-3 tracking-wide">{v.name}: <span className="font-medium text-slate-500 ml-2">{selectedVariants[v.name]}</span></h4>
              <div className="flex flex-wrap gap-3 w-full max-h-[240px] overflow-y-auto custom-scrollbar pr-2 pb-1">
                {v.options.map((opt: string, i: number) => (
                  <button 
                    key={i} onClick={() => setSelectedVariants({...selectedVariants, [v.name]: opt})}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all break-words whitespace-normal text-left max-w-full border ${selectedVariants[v.name] === opt ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <h3 className="font-bold text-slate-900 mb-4 tracking-tight text-lg">Key Highlights</h3>
          <ul className="space-y-3 text-sm text-slate-600 mb-8 w-full">
            {keyFeatures.length > 0 ? keyFeatures.map((feat, idx) => (
              <li key={idx} className="flex gap-3 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0"></span>
                <span className="break-words">{typeof feat === 'string' ? feat : JSON.stringify(feat)}</span>
              </li>
            )) : <li className="text-slate-400 italic">No details available.</li>}
          </ul>
          
          <div onClick={() => document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm cursor-pointer flex items-center gap-1 w-max transition">
            <ChevronDown className="w-4 h-4 shrink-0"/> View detailed specifications
          </div>
        </div>

        <div className="w-full lg:w-3/12 max-w-full">
          <div className="border border-slate-100 rounded-3xl p-6 sm:p-8 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:sticky lg:top-28 w-full overflow-hidden">
            
            <div className="mb-6">
              <span className="text-4xl font-black text-slate-900 tracking-tight">৳{displayPrice.toLocaleString()}</span>
              {discountPercent > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-md uppercase tracking-wider">Save {discountPercent}%</span>
                  <span className="text-sm text-slate-400 line-through font-medium">৳{regularPrice.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3 mb-6 w-full">
              <label className={`flex items-start gap-3 p-4 border rounded-2xl cursor-pointer transition w-full ${paymentMethod === 'emi' ? 'bg-indigo-50 border-indigo-200' : 'border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" name="payment" value="emi" className="mt-1 accent-indigo-600 shrink-0" checked={paymentMethod === 'emi'} onChange={() => setPaymentMethod('emi')} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 break-words">With Exchange / EMI</div>
                  <div className="text-indigo-600 font-semibold text-xs mt-0.5 break-words">Up to ৳{Math.floor(displayPrice * 0.4).toLocaleString()} off</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 border rounded-2xl cursor-pointer transition w-full ${paymentMethod === 'cash' ? 'bg-indigo-50 border-indigo-200' : 'border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" name="payment" value="cash" className="mt-1 accent-indigo-600 shrink-0" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 break-words">Without Exchange</div>
                  <div className="text-slate-500 font-medium text-xs mt-0.5 break-words">Full payment required</div>
                </div>
              </label>
            </div>

            <div className="space-y-4 mb-6 text-sm">
              <div className="flex gap-3 items-center text-slate-600 font-medium bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <Truck className="w-5 h-5 text-slate-400 shrink-0"/> <span>Free standard delivery.</span>
              </div>
              <h3 className={`font-bold text-base tracking-tight ${product.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {product.stock > 0 ? 'Ready to ship' : 'Out of stock'}
              </h3>
            </div>

            {product.stock > 0 && (
              <div className="space-y-3 w-full border-b border-slate-100 pb-6 mb-6">
                <div className="mb-4 w-full">
                  <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white hover:bg-slate-50 cursor-pointer shadow-sm w-full transition">
                    {[...Array(Math.min(10, product.stock))].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Quantity: {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3 w-full">
                  <button onClick={() => { for(let i=0; i<quantity; i++) addToCart(product, 1); openCart(); }} className="w-full bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 py-3.5 rounded-full text-sm font-bold transition">
                    Add to Bag
                  </button>
                  <button onClick={handleBuyNow} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-full text-sm font-bold shadow-md transition">
                    Checkout Now
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 justify-center mb-6 break-words">
              <Lock className="w-3.5 h-3.5 shrink-0" /> Secure encrypted transaction
            </div>

            <div className="flex flex-col gap-2 pt-2 w-full">
              <button onClick={() => toggleWishlist(product)} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 py-2.5 rounded-xl transition border border-transparent hover:border-slate-100">
                <Bookmark className={`w-4 h-4 ${isSaved(product.id) ? 'fill-current text-slate-900' : ''}`} /> 
                {isSaved(product.id) ? 'Saved to Wishlist' : 'Add to Wishlist'}
              </button>
              
              <button onClick={() => addToCompare(product)} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 py-2.5 rounded-xl transition border border-transparent hover:border-slate-100">
                <Scale className="w-4 h-4" /> 
                Compare Product
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 my-16 w-full max-w-6xl mx-auto"></div>

      {similarProducts.length > 0 && (
        <div className="mb-16 w-full max-w-6xl mx-auto overflow-hidden">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Frequently Bought Together</h2>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm w-full">
            <div className="flex items-center gap-6 shrink-0">
              <div className="relative bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <img src={selectedImage} className="w-24 h-24 sm:w-32 sm:h-32 object-contain mix-blend-multiply" />
                <div className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1"><CheckCircle className="w-4 h-4"/></div>
              </div>
              <span className="text-3xl text-slate-300 font-light">+</span>
              <div className="relative bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <img src={similarProducts[0].image_display_url || similarProducts[0].image_url} className="w-24 h-24 sm:w-32 sm:h-32 object-contain mix-blend-multiply" />
                <div className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1"><CheckCircle className="w-4 h-4"/></div>
              </div>
            </div>
            <div className="space-y-4 min-w-0 flex-1">
              <div className="text-slate-500 font-medium">Bundle Price: <span className="text-slate-900 font-black text-2xl ml-2">৳{(displayPrice + Number(similarProducts[0].cash_discount_price || similarProducts[0].price)).toLocaleString()}</span></div>
              <button className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-full text-sm font-bold shadow-md transition w-full sm:w-auto">
                Add Bundle to Cart
              </button>
              <div className="text-xs text-slate-400 font-medium break-words">Items may be dispatched from different AuraTech fulfillment centers.</div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-16 w-full max-w-7xl mx-auto overflow-hidden">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Related Products</h2>
        <div className="flex overflow-x-auto gap-6 pb-6 custom-scrollbar px-2">
          {similarProducts.map(sp => (
            <div key={sp.id} className="w-48 sm:w-56 shrink-0 group cursor-pointer bg-white rounded-3xl p-4 border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300" onClick={() => window.location.href=`/product/${sp.id}`}>
              <div className="h-40 sm:h-48 flex items-center justify-center mb-4 bg-slate-50 rounded-2xl p-4"><img src={sp.image_display_url || sp.image_url} className="max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" /></div>
              <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 line-clamp-2 mb-2 tracking-tight break-words">{sp.name}</div>
              <div className="text-slate-900 font-black text-lg">৳{Number(sp.cash_discount_price || sp.price).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 my-16 w-full max-w-6xl mx-auto" id="details-section"></div>

      {specifications.length > 0 && (
        <div className="mb-16 scroll-mt-28 w-full max-w-4xl mx-auto overflow-hidden">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-8 text-center">Tech Specs</h2>
          <div className="rounded-3xl border border-slate-100 overflow-hidden bg-white shadow-sm">
            {specifications.map((group: any, idx: number) => (
              <div key={idx} className="border-b border-slate-100 last:border-0 w-full">
                <button 
                  onClick={() => setExpandedSpec(expandedSpec === idx ? null : idx)}
                  className="w-full p-6 flex justify-between items-center transition bg-slate-50/50 hover:bg-slate-50 text-left"
                >
                  <span className="font-bold text-slate-900 text-base break-words pr-2 tracking-tight">{group.groupName || group.group}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${expandedSpec === idx ? 'rotate-180' : ''}`}/>
                </button>
                {expandedSpec === idx && (
                  <div className="bg-white px-6 pb-6">
                    <div className="divide-y divide-slate-100 border-t border-slate-100 pt-4">
                      {(group.features || group.attributes)?.map((f: any, fIdx: number) => (
                        <div key={fIdx} className="py-3 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-8">
                          <span className="text-sm font-bold text-slate-900 sm:w-1/3 break-words">{f.key || f.name}</span>
                          {/* WHITE-PRE-LINE ALLOWS MULTI-LINE SPEC VALUES */}
                          <span className="text-sm text-slate-600 sm:w-2/3 leading-relaxed break-words whitespace-pre-line">{f.value}</span>
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

      <div className="mb-16 w-full max-w-4xl mx-auto overflow-hidden bg-white p-8 sm:p-12 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-6 text-center">Product Overview</h2>
        <div className="text-base text-slate-600 leading-relaxed break-words max-w-3xl mx-auto text-center" dangerouslySetInnerHTML={{ __html: product.description.replace(/\n/g, '<br/>') }} />
      </div>

      <div className="border-t border-slate-100 my-16 w-full max-w-6xl mx-auto"></div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 mb-16 w-full max-w-6xl mx-auto">
        <div className="lg:col-span-4 w-full">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-6">Customer Reviews</h2>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 fill-current"/>
              <span className="font-bold text-sm">{avgRating}</span>
            </div>
            <span className="text-base font-medium text-slate-500">out of 5</span>
          </div>
          <div className="text-sm font-medium text-slate-400 mb-8">{reviews.length} verified global ratings</div>
          
          <div className="space-y-3 mb-10">
            {[ {s:5, p:65}, {s:4, p:20}, {s:3, p:10}, {s:2, p:3}, {s:1, p:2} ].map(bar => (
              <div key={bar.s} className="flex items-center gap-4 text-sm font-medium text-slate-600 cursor-pointer group">
                <span className="w-12 text-right group-hover:text-slate-900 transition">{bar.s} star</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: `${bar.p}%` }}></div>
                </div>
                <span className="w-8 text-right text-slate-400">{bar.p}%</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4 w-full">
            <h3 className="font-bold text-slate-900 text-lg tracking-tight">Share your thoughts</h3>
            <p className="text-sm text-slate-500">Help other customers make an informed decision.</p>
            
            <button 
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="w-full py-3 bg-white border border-slate-200 rounded-full shadow-sm text-slate-900 font-bold hover:bg-slate-50 hover:border-slate-300 transition"
            >
              {showReviewForm ? 'Cancel Review' : 'Write a Review'}
            </button>

            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} className="mt-6 pt-6 border-t border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2 w-full">
                <div className="w-full">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Your Name</label>
                  <input type="text" required value={reviewerName} onChange={e => setReviewerName(e.target.value)} placeholder="John Doe" className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition" />
                </div>
                <div className="w-full">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Rating</label>
                  <select value={newRating} onChange={e => setNewRating(Number(e.target.value))} className="w-full border border-slate-200 p-3.5 rounded-xl text-sm bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-bold text-slate-900 transition">
                    <option value={5}>★★★★★ (5 Stars - Excellent)</option>
                    <option value={4}>★★★★☆ (4 Stars - Good)</option>
                    <option value={3}>★★★☆☆ (3 Stars - Average)</option>
                    <option value={2}>★★☆☆☆ (2 Stars - Poor)</option>
                    <option value={1}>★☆☆☆☆ (1 Star - Terrible)</option>
                  </select>
                </div>
                <div className="w-full">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Comment</label>
                  <textarea rows={4} required value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="What did you love about this product?" className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition resize-none" />
                </div>
                <button type="submit" disabled={submittingReview} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70">
                  <Send className="w-4 h-4" /> {submittingReview ? 'Submitting...' : 'Post Review'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 w-full overflow-hidden">
          <h3 className="font-black text-slate-900 text-xl mb-8 tracking-tight">Recent Verified Reviews</h3>
          {reviews.length === 0 ? (
            <div className="bg-slate-50 rounded-3xl p-12 text-center border border-slate-100">
              <Star className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Be the first to review this item.</p>
            </div>
          ) : (
            <div className="space-y-6 w-full">
              {reviews.map((rev: any, idx: number) => (
                <div key={idx} className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm w-full transition hover:shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200"><UserIcon className="w-5 h-5"/></div>
                      <div>
                        <span className="text-sm font-bold text-slate-900 block break-words">{rev.user_name}</span>
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 mt-0.5"><CheckCircle className="w-3 h-3"/> Verified</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 fill-slate-900 text-slate-900"/><span className="text-sm font-bold text-slate-900">{rev.rating}</span>
                    </div>
                  </div>
                  
                  <p className="text-slate-600 text-sm leading-relaxed mb-4 break-words">"{rev.comment}"</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="text-xs font-medium text-slate-400 break-words">{new Date(rev.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div className="flex items-center gap-3">
                      <button className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition">Helpful</button>
                      <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                      <button className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition">Report</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};