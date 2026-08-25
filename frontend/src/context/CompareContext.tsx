import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types';

interface CompareContextType {
  compareItems: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: number) => void;
  clearCompare: () => void;
  isCompareOpen: boolean;
  openCompare: () => void;
  closeCompare: () => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export const CompareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [compareItems, setCompareItems] = useState<Product[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('aura_compare');
    if (stored) {
      try {
        setCompareItems(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse compare items');
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('aura_compare', JSON.stringify(compareItems));
  }, [compareItems]);

  const addToCompare = (product: Product) => {
    // Prevent adding duplicates
    if (compareItems.some(item => item.id === product.id)) {
      alert('This product is already in your comparison list.');
      return;
    }
    
    // Expanded Limit for Multi-Product AI Analysis
    if (compareItems.length >= 4) {
      alert('You can compare a maximum of 4 products at a time to ensure optimal AI accuracy.');
      return;
    }
    
    setCompareItems(prev => [...prev, product]);
    setIsCompareOpen(true);
  };

  const removeFromCompare = (productId: number) => {
    setCompareItems(prev => prev.filter(item => item.id !== productId));
  };

  const clearCompare = () => {
    setCompareItems([]);
  };

  const openCompare = () => setIsCompareOpen(true);
  const closeCompare = () => setIsCompareOpen(false);

  return (
    <CompareContext.Provider value={{ compareItems, addToCompare, removeFromCompare, clearCompare, isCompareOpen, openCompare, closeCompare }}>
      {children}
    </CompareContext.Provider>
  );
};

export const useCompare = () => {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
};