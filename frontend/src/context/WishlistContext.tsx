import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types';

interface WishlistContextType {
  wishlistItems: Product[];
  toggleWishlist: (product: Product) => void;
  isSaved: (productId: number) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState<Product[]>(() => {
    const saved = localStorage.getItem('aurastore_wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('aurastore_wishlist', JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  const toggleWishlist = (product: Product) => {
    setWishlistItems(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) return prev.filter(item => item.id !== product.id);
      return [...prev, product];
    });
  };

  const isSaved = (productId: number) => {
    return wishlistItems.some(item => item.id === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, toggleWishlist, isSaved }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
};