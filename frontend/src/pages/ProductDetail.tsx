import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, MapPin, Lock, ShieldCheck, RefreshCcw, Truck, Award, CheckCircle, ChevronDown, ChevronRight, User as UserIcon, Send } from 'lucide-react';
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

  // Review Form States
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
      alert('Review submitted successfully!');
      setNewComment(''); setReviewerName(''); setShowReviewForm(false); loadData();
    } catch (err) { alert('Failed to submit review.'); } finally { setSubmittingReview(false); }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - left) / width * 100;
    const y = (e.clientY - top) / height * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%`, transform: 'scale(2.5)' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Loading product details...</div>;
  if (error || !product) return <div className="min-h-screen flex items-center justify-center font-bold text-rose-500">{error || "Product not found"}</div>;

  const displayPrice = Number(product.cash_discount_price || product.price || 0);
  const regularPrice = Number(product.regular_price || displayPrice * 1.25);
  const emiPrice = Math.ceil(regularPrice / 12);
  const activePrice = paymentMethod === 'cash' ? displayPrice : regularPrice;
  const discountPercent = regularPrice > displayPrice ? Math.round(((regularPrice - displayPrice) / regularPrice) * 100) : 0;

  const allImages = [product.image_display_url || product.image_url, ...(product.image_gallery || [])].filter(Boolean);
  const keyFeatures = Array.isArray(product.key_features) ? product.key_features : [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  
  const avgRating = reviews.length > 0 ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  return (
    // FIXED: Added overflow-x-hidden and w-full to root to strictly prevent horizontal blowout
    <div className="max-w-[1500px] mx-auto px-4 py-4 font-sans text-[#0f1111] bg-white w-full overflow-x-hidden">
      
      {/* Responsive Breadcrumbs */}
      <div className="text-xs text-[#565959] mb-4 flex flex-wrap items-center gap-1">
        <Link to="/" className="hover:underline">Electronics</Link> <ChevronRight className="w-3 h-3 shrink-0"/>
        <Link to={`/?category=${product.category_slug || product.category}`} className="hover:underline break-all line-clamp-1">{product.category_name || 'Category'}</Link> <ChevronRight className="w-3 h-3 shrink-0"/>
        <Link to={`/?search=${product.brand}`} className="hover:underline break-all line-clamp-1">{product.brand || 'Brand'}</Link>
      </div>

      {/* 3-COLUMN MAIN LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6 mb-10 w-full">
        
        {/* LEFT COLUMN: Gallery */}
        <div className="w-full lg:w-4/12 flex flex-col-reverse md:flex-row gap-4 lg:sticky lg:top-24 self-start z-10">
          <div className="flex md:flex-col gap-2 overflow-x-auto w-full md:w-16 shrink-0 no-scrollbar pb-2 md:pb-0">
            {allImages.map((img, idx) => (
              <button 
                key={idx} onMouseEnter={() => setSelectedImage(img)} onClick={() => setSelectedImage(img)}
                className={`w-14 h-14 sm:w-14 sm:h-14 border rounded p-1 bg-white shrink-0 overflow-hidden ${selectedImage === img ? 'border-[#3749bb] shadow-[0_0_3px_rgba(55,73,187,0.5)]' : 'border-[#d5d9d9] hover:border-[#3749bb]'}`}
              >
                <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
          <div className="w-full bg-white flex items-center justify-center relative overflow-hidden rounded-lg border border-slate-100 aspect-square md:aspect-auto md:min-h-[400px]">
            {selectedImage ? (
              <img 
                src={selectedImage} alt={product.name} 
                onMouseMove={handleMouseMove} onMouseLeave={() => setZoomStyle({ transformOrigin: 'center center', transform: 'scale(1)' })}
                className="w-full h-full max-h-full md:max-h-[500px] object-contain p-4 transition-transform duration-75 ease-out cursor-crosshair"
                style={zoomStyle}
              />
            ) : (
              <div className="text-slate-400 font-bold">No Image Available</div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Core Info & Variants */}
        <div className="w-full lg:w-5/12 flex flex-col overflow-hidden max-w-full">
          <h1 className="text-[20px] sm:text-[22px] font-medium leading-tight mb-1 text-[#0f1111] break-words">{product.name}</h1>
          <Link to={`/?search=${product.brand}`} className="text-sm text-[#3749bb] hover:text-[#ef4a23] hover:underline mb-2">Brand: {product.brand || 'AuraTech'}</Link>
          
          <div className="flex items-center gap-4 mb-2 border-b border-[#e7e7e7] pb-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold">{avgRating}</span>
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < Math.round(Number(avgRating)) ? 'fill-current' : 'text-[#d5d9d9] fill-current'}`} />))}
              </div>
              <ChevronDown className="w-3 h-3 text-[#565959] cursor-pointer hidden sm:block"/>
            </div>
            <span className="text-sm text-[#3749bb] hover:text-[#ef4a23] hover:underline cursor-pointer">{reviews.length} ratings</span>
          </div>

          <div className="text-sm text-[#565959] mb-3">100+ bought in past month</div>

          {/* Pricing Section */}
          <div className="mb-4">
            <div className="flex items-start gap-3">
              {discountPercent > 0 && <span className="text-[24px] sm:text-[28px] font-light text-[#ef4a23]">-{(discountPercent).toString()}%</span>}
              <span className="text-[24px] sm:text-[28px] font-medium text-[#0f1111]">
                <span className="text-sm align-top">৳</span>{displayPrice.toLocaleString()}
              </span>
            </div>
            {discountPercent > 0 && <div className="text-sm text-[#565959]">M.R.P.: <span className="line-through">৳{regularPrice.toLocaleString()}</span></div>}
            <div className="text-sm text-[#0f1111] mt-1">Inclusive of all taxes</div>
            <div className="text-sm text-[#0f1111] font-bold mt-1">EMI <span className="font-normal text-[#565959]">starts at ৳{emiPrice}. No Cost EMI available.</span> <span className="text-[#3749bb] hover:underline cursor-pointer font-normal hidden sm:inline">EMI options <ChevronDown className="w-3 h-3 inline"/></span></div>
          </div>

          {/* Service Icons Strip */}
          <div className="flex items-start justify-between border-y border-[#e7e7e7] py-3 mb-4 overflow-x-auto no-scrollbar gap-4">
            {[
              { icon: RefreshCcw, text: "10 days Replacement" },
              { icon: Truck, text: "Free Delivery" },
              { icon: ShieldCheck, text: "1 Year Warranty" },
              { icon: Award, text: "Top Brand" },
              { icon: CheckCircle, text: "Aura Delivered" }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center text-center w-16 shrink-0 cursor-pointer group">
                <div className="w-9 h-9 rounded-full bg-[#f0f2f2] flex items-center justify-center mb-1 group-hover:bg-[#e3e6e6] transition"><item.icon className="w-5 h-5 text-[#0f1111] opacity-80" strokeWidth={1.5}/></div>
                <span className="text-[11px] text-[#3749bb] group-hover:text-[#ef4a23] hover:underline leading-tight">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Variants (FIXED: Added whitespace-normal and break-words to ensure huge strings wrap correctly) */}
          {product.variants && Array.isArray(product.variants) && product.variants.map((v, idx) => (
            <div key={idx} className="mb-4 w-full">
              <h4 className="text-sm text-[#565959] mb-2">{v.name}: <span className="font-bold text-[#0f1111]">{selectedVariants[v.name]}</span></h4>
              <div className="flex flex-wrap gap-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-2 pb-1 w-full">
                {v.options.map((opt: string, i: number) => (
                  <button 
                    key={i} onClick={() => setSelectedVariants({...selectedVariants, [v.name]: opt})}
                    className={`px-3 py-1.5 border text-sm transition break-words whitespace-normal text-left max-w-full ${selectedVariants[v.name] === opt ? 'border-[#3749bb] bg-indigo-50 shadow-[0_0_0_1px_#3749bb] font-bold text-[#3749bb]' : 'border-[#d5d9d9] hover:bg-[#f7fafa]'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quick Specs Table */}
          {specifications.length > 0 && specifications[0].features && (
            <div className="mb-4 overflow-x-auto w-full">
              <table className="w-full text-sm break-words table-fixed">
                <tbody>
                  {specifications[0].features.slice(0, 6).map((f: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-1 font-bold text-[#0f1111] w-1/3 align-top break-words pr-2">{f.key}</td>
                      <td className="py-1 text-[#0f1111] align-top break-words">{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-3 border-t border-[#e7e7e7] w-full">
            <h3 className="font-bold text-[#0f1111] text-base mb-2">About this item</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-[#0f1111] break-words">
              {keyFeatures.length > 0 ? keyFeatures.map((feat, idx) => (
                <li key={idx} className="leading-relaxed">{typeof feat === 'string' ? feat : JSON.stringify(feat)}</li>
              )) : <li>No details available.</li>}
            </ul>
            <div onClick={() => document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-[#3749bb] hover:text-[#ef4a23] hover:underline text-sm mt-2 cursor-pointer flex items-center gap-1">
               <ChevronDown className="w-3 h-3 shrink-0"/> See more product details
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Buy Box */}
        <div className="w-full lg:w-3/12 max-w-full">
          <div className="border border-[#d5d9d9] rounded-lg p-4 bg-white shadow-[0_0_4px_rgba(0,0,0,0.1)] lg:sticky lg:top-24 w-full overflow-hidden">
            
            {/* Embedded Payment Toggle */}
            <div className="space-y-3 mb-4 w-full">
              <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition w-full ${paymentMethod === 'emi' ? 'bg-indigo-50 border-[#3749bb]' : 'border-[#d5d9d9] hover:bg-[#f7fafa]'}`}>
                <input type="radio" name="payment" value="emi" className="mt-1 accent-[#3749bb] shrink-0" checked={paymentMethod === 'emi'} onChange={() => setPaymentMethod('emi')} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-[#0f1111] break-words">With Exchange / EMI</div>
                  <div className="text-[#ef4a23] font-bold text-sm break-words">Up to ৳{Math.floor(displayPrice * 0.4).toLocaleString()} off</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition w-full ${paymentMethod === 'cash' ? 'bg-indigo-50 border-[#3749bb]' : 'border-[#d5d9d9] hover:bg-[#f7fafa]'}`}>
                <input type="radio" name="payment" value="cash" className="mt-1 accent-[#3749bb] shrink-0" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-[#0f1111] break-words">Without Exchange</div>
                  <div className="text-[#ef4a23] font-medium text-sm break-words">৳{displayPrice.toLocaleString()} <span className="text-[#565959] line-through text-xs ml-1">৳{regularPrice.toLocaleString()}</span></div>
                </div>
              </label>
            </div>

            <div className="mb-3 text-sm text-[#0f1111] break-words">
              <span className="text-[#3749bb] hover:underline cursor-pointer">FREE delivery</span> <strong>Sunday, {new Date(Date.now() + 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}</strong>.
            </div>

            <div className="flex items-start gap-1 text-sm text-[#3749bb] hover:text-[#ef4a23] hover:underline cursor-pointer mb-4 font-medium break-words">
              <MapPin className="w-4 h-4 mt-0.5 text-[#0f1111] shrink-0"/> Delivering to Dhaka 1000 - Update location
            </div>

            <h3 className={`text-[18px] font-medium mb-3 ${product.stock > 0 ? 'text-emerald-600' : 'text-[#ef4a23]'}`}>
              {product.stock > 0 ? 'In stock' : 'Currently unavailable.'}
            </h3>

            {product.stock > 0 && (
              <>
                <div className="mb-4 w-full">
                  <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="border border-[#d5d9d9] rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#3749bb] focus:shadow-[0_0_3px_rgba(55,73,187,0.5)] bg-[#f0f2f2] hover:bg-[#e3e6e6] cursor-pointer shadow-sm w-full">
                    {[...Array(Math.min(10, product.stock))].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Quantity: {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 mb-4 w-full">
                  <button onClick={() => { for(let i=0; i<quantity; i++) addToCart(product, 1); openCart(); }} className="w-full bg-slate-800 hover:bg-black text-white py-2.5 rounded-full text-sm font-bold shadow-sm">
                    Add to Cart
                  </button>
                  <button onClick={handleBuyNow} className="w-full bg-[#ef4a23] hover:bg-orange-600 text-white py-2.5 rounded-full text-sm font-bold shadow-sm">
                    Buy Now
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center gap-2 text-sm text-[#3749bb] hover:text-[#ef4a23] hover:underline mb-4 cursor-pointer break-words">
              <Lock className="w-4 h-4 text-[#565959] shrink-0" /> Secure transaction
            </div>

            <table className="text-xs text-[#565959] w-full mb-4 table-fixed">
              <tbody>
                <tr><td className="py-0.5 w-20 sm:w-24 align-top">Ships from</td><td className="py-0.5 text-[#0f1111] break-words">AuraTech</td></tr>
                <tr><td className="py-0.5 align-top">Sold by</td><td className="py-0.5 text-[#3749bb] hover:underline cursor-pointer break-words">AuraTech</td></tr>
                <tr><td className="py-0.5 align-top">Returns</td><td className="py-0.5 text-[#3749bb] hover:underline cursor-pointer break-words">7-day replacement</td></tr>
              </tbody>
            </table>

            <div className="border-t border-[#e7e7e7] pt-3 mb-4 w-full">
              <div className="font-bold text-sm text-[#0f1111] mb-2">Add a Protection Plan:</div>
              <label className="flex items-start gap-2 text-sm cursor-pointer mb-2 w-full">
                <input type="checkbox" className="mt-1 accent-[#3749bb] shrink-0"/>
                <span className="text-[#0f1111] break-words min-w-0">1 Year Warranty for <span className="text-[#ef4a23]">৳499.00</span></span>
              </label>
            </div>

            <div className="border-t border-[#e7e7e7] pt-3 w-full">
              <button onClick={() => toggleWishlist(product)} className="w-full text-left text-sm text-[#0f1111] py-1.5 px-3 border border-[#d5d9d9] rounded-md shadow-sm hover:bg-[#f7fafa] bg-white transition break-words">
                Add to Wish List
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#e7e7e7] my-8"></div>

      {/* FREQUENTLY BOUGHT TOGETHER */}
      {similarProducts.length > 0 && (
        <div className="mb-10 w-full overflow-hidden">
          <h2 className="text-[#ef4a23] font-bold text-xl mb-4">Frequently bought together</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full">
            <div className="flex items-center gap-4 shrink-0">
              <div className="relative">
                <img src={selectedImage} className="w-24 h-24 sm:w-28 sm:h-28 object-contain" />
                <input type="checkbox" checked readOnly className="absolute top-0 left-0 accent-[#3749bb] w-4 h-4" />
              </div>
              <span className="text-2xl text-[#565959]">+</span>
              <div className="relative">
                <img src={similarProducts[0].image_display_url || similarProducts[0].image_url} className="w-24 h-24 sm:w-28 sm:h-28 object-contain" />
                <input type="checkbox" checked readOnly className="absolute top-0 left-0 accent-[#3749bb] w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <div className="text-sm text-[#0f1111] break-words">Total price: <span className="text-[#ef4a23] font-bold text-lg">৳{(displayPrice + Number(similarProducts[0].cash_discount_price || similarProducts[0].price)).toLocaleString()}</span></div>
              <button className="bg-[#3749bb] hover:bg-indigo-900 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-sm transition w-full sm:w-auto">
                Add both to Cart
              </button>
              <div className="text-xs text-[#565959] hidden sm:block break-words">These items are dispatched from and sold by different sellers. <span className="text-[#3749bb] hover:underline cursor-pointer">Show details</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-[#e7e7e7] my-8"></div>

      {/* CUSTOMERS WHO VIEWED (Horizontal Scroll) */}
      <div className="mb-10 w-full overflow-hidden">
        <h2 className="text-[#ef4a23] font-bold text-xl mb-4">Customers who viewed this item also viewed</h2>
        <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar">
          {similarProducts.map(sp => (
            <div key={sp.id} className="w-36 sm:w-40 shrink-0 group cursor-pointer" onClick={() => window.location.href=`/product/${sp.id}`}>
              <div className="h-36 sm:h-40 flex items-center justify-center mb-2"><img src={sp.image_display_url || sp.image_url} className="max-h-full object-contain mix-blend-multiply" /></div>
              <div className="text-[13px] text-[#3749bb] group-hover:text-[#ef4a23] group-hover:underline line-clamp-3 mb-1 break-words">{sp.name}</div>
              <div className="flex text-amber-400 mb-1"><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 text-[#d5d9d9] fill-current"/></div>
              <div className="text-[#ef4a23] font-medium text-[15px]">৳{Number(sp.cash_discount_price || sp.price).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e7e7e7] my-8" id="details-section"></div>

      {/* PRODUCT INFORMATION (Accordions - FIXED overflow on tables) */}
      {specifications.length > 0 && (
        <div className="mb-10 scroll-mt-24 w-full overflow-hidden">
          <h2 className="text-[#ef4a23] font-bold text-xl mb-4">{product.name} Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 items-start border-t border-[#e7e7e7]">
            {specifications.map((group: any, idx: number) => (
              <div key={idx} className="border-b border-[#e7e7e7] w-full">
                <button 
                  onClick={() => setExpandedSpec(expandedSpec === idx ? null : idx)}
                  className={`w-full py-3 flex justify-between items-center transition text-left ${expandedSpec === idx ? 'bg-[#f0f2f2] px-4 border border-[#e7e7e7] border-b-0 rounded-t-md mt-3' : 'bg-transparent hover:bg-slate-50'}`}
                >
                  <span className="font-bold text-[#0f1111] text-[15px] break-words pr-2">{group.groupName || group.group}</span>
                  <ChevronDown className={`w-5 h-5 text-[#565959] shrink-0 transition-transform ${expandedSpec === idx ? 'rotate-180' : ''}`}/>
                </button>
                {expandedSpec === idx && (
                  <div className="bg-white border border-[#e7e7e7] border-t-0 rounded-b-md mb-3 w-full">
                    <table className="w-full text-sm break-words table-fixed">
                      <tbody>
                        {(group.features || group.attributes)?.map((f: any, fIdx: number) => (
                          <tr key={fIdx} className="border-t border-[#e7e7e7] first:border-0">
                            <td className="py-2.5 px-3 sm:px-4 bg-[#f3f3f3] text-[#0f1111] w-1/2 align-top border-r border-[#e7e7e7] font-medium break-words">{f.key || f.name}</td>
                            <td className="py-2.5 px-3 sm:px-4 bg-white text-[#0f1111] w-1/2 align-top break-words">{f.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[#e7e7e7] my-8"></div>

      {/* PRODUCT DESCRIPTION */}
      <div className="mb-10 w-full overflow-hidden">
        <h2 className="text-[#ef4a23] font-bold text-xl mb-4">Product description</h2>
        <div className="text-sm text-[#0f1111] leading-relaxed max-w-4xl break-words" dangerouslySetInnerHTML={{ __html: product.description.replace(/\n/g, '<br/>') }} />
      </div>

      <div className="border-t border-[#e7e7e7] my-8"></div>

      {/* CUSTOMER REVIEWS & FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10 w-full">
        <div className="lg:col-span-4 w-full">
          <h2 className="text-xl font-bold text-[#0f1111] mb-2">Customer reviews</h2>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex text-amber-400"><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 text-[#d5d9d9] fill-current"/></div>
            <span className="text-[18px] font-medium text-[#0f1111]">{avgRating} out of 5</span>
          </div>
          <div className="text-sm text-[#565959] mb-4">{reviews.length} global ratings</div>
          
          <div className="space-y-2 mb-6">
            {[ {s:5, p:65}, {s:4, p:20}, {s:3, p:10}, {s:2, p:3}, {s:1, p:2} ].map(bar => (
              <div key={bar.s} className="flex items-center gap-3 text-sm text-[#3749bb] hover:text-[#ef4a23] hover:underline cursor-pointer">
                <span className="w-12 text-right">{bar.s} star</span>
                <div className="flex-1 h-4 border border-[#d5d9d9] rounded-sm bg-[#f0f2f2] overflow-hidden">
                  <div className="h-full bg-amber-400 border-r border-amber-500" style={{ width: `${bar.p}%` }}></div>
                </div>
                <span className="w-8 text-right text-[#0f1111]">{bar.p}%</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#e7e7e7] pt-6 space-y-4 w-full">
            <h3 className="font-bold text-[#0f1111] text-lg">Review this product</h3>
            <p className="text-sm text-[#565959]">Share your thoughts with other customers</p>
            
            <button 
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="w-full py-1.5 border border-[#d5d9d9] rounded-md shadow-sm text-[#0f1111] text-sm hover:bg-[#f7fafa] font-medium transition"
            >
              {showReviewForm ? 'Cancel Review' : 'Write a product review'}
            </button>

            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} className="mt-4 pt-4 border-t border-[#e7e7e7] space-y-4 animate-in fade-in slide-in-from-top-2 w-full">
                <h3 className="font-bold text-[#0f1111] text-lg">Submit your review</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  <div className="w-full">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Name</label>
                    <input type="text" required value={reviewerName} onChange={e => setReviewerName(e.target.value)} placeholder="Enter your name" className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none" />
                  </div>
                  <div className="w-full">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rating</label>
                    <select value={newRating} onChange={e => setNewRating(Number(e.target.value))} className="w-full border border-slate-300 p-3 rounded-xl text-sm bg-white focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none font-bold text-amber-500">
                      <option value={5}>★★★★★ (5 Stars - Excellent)</option>
                      <option value={4}>★★★★☆ (4 Stars - Good)</option>
                      <option value={3}>★★★☆☆ (3 Stars - Average)</option>
                      <option value={2}>★★☆☆☆ (2 Stars - Poor)</option>
                      <option value={1}>★☆☆☆☆ (1 Star - Terrible)</option>
                    </select>
                  </div>
                </div>
                <div className="w-full">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Comment</label>
                  <textarea rows={4} required value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="What did you like or dislike?" className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:border-[#3749bb] focus:ring-1 focus:ring-[#3749bb] outline-none" />
                </div>
                <button type="submit" disabled={submittingReview} className="w-full sm:w-auto px-6 py-3 bg-[#3749bb] hover:bg-indigo-900 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70">
                  <Send className="w-4 h-4" /> {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 w-full overflow-hidden">
          <h3 className="font-bold text-[#0f1111] text-lg mb-4 mt-8 lg:mt-0">Top reviews from Bangladesh</h3>
          {reviews.length === 0 ? (
            <p className="text-sm text-[#565959] italic">No reviews yet.</p>
          ) : (
            <div className="space-y-6 w-full">
              {reviews.map((rev: any, idx: number) => (
                <div key={idx} className="space-y-2 w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#e3e6e6] flex items-center justify-center text-[#fff] shrink-0"><UserIcon className="w-5 h-5"/></div>
                    <span className="text-sm text-[#0f1111] font-medium break-words">{rev.user_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex text-amber-400 shrink-0"><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 fill-current"/><Star className="w-3 h-3 text-[#d5d9d9] fill-current"/></div>
                    <span className="text-sm font-bold text-[#0f1111] break-words">Verified Buyer</span>
                  </div>
                  <div className="text-xs text-[#565959] break-words">Reviewed in Bangladesh on {new Date(rev.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div className="text-xs text-[#ef4a23] font-bold">Verified Purchase</div>
                  <p className="text-sm text-[#0f1111] break-words">{rev.comment}</p>
                  <div className="text-xs text-[#565959] mt-2">Found this helpful</div>
                  <div className="flex items-center gap-4 mt-2">
                    <button className="px-6 py-1 border border-[#d5d9d9] rounded-md shadow-sm text-sm text-[#0f1111] hover:bg-[#f7fafa] transition">Helpful</button>
                    <span className="text-sm text-[#565959] border-l border-[#d5d9d9] pl-4 cursor-pointer hover:underline">Report</span>
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