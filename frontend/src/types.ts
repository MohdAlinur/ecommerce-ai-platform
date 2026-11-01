export interface Review {
  id?: number;
  product: number;
  product_name?: string;
  user?: number | null;
  user_name: string;
  rating: number;
  comment: string;
  is_approved?: boolean;
  created_at?: string;
}

export interface SpecAttribute {
  name?: string;
  key?: string;
  value: string;
}

export interface SpecGroup {
  group?: string;
  groupName?: string;
  attributes?: SpecAttribute[];
  features?: SpecAttribute[];
}

export interface ProductVariant {
  name: string;
  options: string[];
}

export interface Product {
  id: number;
  category: number;
  category_name?: string;
  category_slug?: string;
  name: string;
  brand?: string;
  product_code?: string;
  description: string;
  cash_discount_price: string | number;
  regular_price?: string | number;
  price?: string | number;
  stock: number;
  is_featured?: boolean;
  image?: string;
  image_url?: string;
  image_display_url?: string;
  image_gallery?: string[];
  variants?: ProductVariant[];
  key_features?: string[];
  specifications?: SpecGroup[];
  reviews?: Review[];
  average_rating?: number;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  product_count?: number;
}

export interface UserProfile {
  id: number;
  username: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  shipping_address?: string;
  default_shipping_address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  avatar_url?: string | null;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariants?: Record<string, string>;
}

export interface OrderItemData {
  id: number;
  product: number | null;
  product_name: string;
  product_image?: string | null;
  selected_variants?: Record<string, string>;
  quantity: number;
  price: string | number;
}

export interface OrderData {
  id: number;
  customer_name: string;
  customer_email: string;
  phone?: string;
  shipping_address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  order_notes?: string;
  payment_method: 'cod' | 'bkash' | 'nagad' | 'card';
  payment_status: 'UNPAID' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED';
  transaction_id?: string;
  card_holder_name?: string;
  card_brand?: string;
  card_last4?: string;
  card_expiry?: string;
  masked_card?: string;
  payment_phone?: string;
  bkash_trx_id?: string;
  paid_at?: string;
  subtotal_amount?: string | number;
  discount_amount?: string | number;
  discount_code?: string;
  shipping_fee?: string | number;
  tax_amount?: string | number;
  total_amount: string | number;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  tracking_number?: string;
  courier_name?: string;
  created_at: string;
  items: OrderItemData[];
}

export interface AIReviewAnalysis {
  summary: string;
  sentiment?: string;
  sentiment_score?: number;
  sentiment_label?: string;
  key_strengths?: string[];
  areas_for_improvement?: string[];
}

export interface StoreHighlights {
  in_stock_products: number;
  active_categories: number;
  top_brands: string[];
  average_store_rating: number;
}

export interface AnalyticsData {
  metrics: {
    total_revenue: number;
    total_orders: number;
    pending_orders?: number;
    processing_orders?: number;
    shipped_orders?: number;
    delivered_orders?: number;
    cancelled_orders?: number;
    total_products: number;
    low_stock_alerts?: number;
    low_stock_products?: number;
    out_of_stock_products?: number;
    total_customers?: number;
    average_rating: number;
  };
  sales_trend: { date: string; revenue: number; orders?: number }[];
  category_distribution: { id?: number; name: string; slug?: string; count: number }[];
  payment_breakdown?: { payment_method: string; count: number; revenue: number }[];
  top_selling_products?: { id: number; name: string; brand: string; units_sold: number; revenue: number }[];
}