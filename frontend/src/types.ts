export interface Review {
  id?: number;
  product: number;
  user_name: string;
  rating: number;
  comment: string;
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

export interface Product {
  id: number;
  category: number;
  category_name?: string;
  name: string;
  brand?: string;
  product_code?: string;
  description: string;
  cash_discount_price: string | number;
  regular_price?: string | number;
  price?: string | number;
  stock: number;
  image_url?: string;
  image_display_url?: string;
  key_features?: string[];
  specifications?: SpecGroup[];
  reviews?: Review[];
  average_rating?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email?: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface AIReviewAnalysis {
  summary: string;
  sentiment?: string;
  sentiment_score?: number;
  sentiment_label?: string;
  key_strengths?: string[];
  areas_for_improvement?: string[];
}

export interface AnalyticsData {
  metrics: {
    total_revenue: number;
    total_orders: number;
    total_products: number;
    average_rating: number;
  };
  sales_trend: { date: string; revenue: number }[];
  category_distribution: { name: string; count: number }[];
}