import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, User } from 'lucide-react';
import { sendSupportChatMessage } from '../api';
import { motion, AnimatePresence } from 'motion/react';
import type { Product } from '../types';

interface ChatMessage {
  sender: 'user' | 'model';
  text: string;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProduct: Product | null;
}

export const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose, currentProduct }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      sender: 'model', 
      text: currentProduct 
        ? `Hello! I see you are looking at the ${currentProduct.name}. Ask me any technical questions about its specifications or features!` 
        : 'Hello! I am your AI Shopping Assistant. Ask me anything about our products, recommendations, or policies!' 
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    const updatedHistory: ChatMessage[] = [...messages, { sender: 'user', text: userMsg }];
    setMessages(updatedHistory);
    setLoading(true);

    let productContext = "";
    if (currentProduct) {
      productContext = `
        The user is currently viewing this specific product:
        Name: ${currentProduct.name}
        Brand: ${currentProduct.brand}
        Product Code: ${currentProduct.product_code}
        Cash Price: $${currentProduct.cash_discount_price}
        Regular Price: $${currentProduct.regular_price}
        Description: ${currentProduct.description}
        Features: ${JSON.stringify(currentProduct.key_features)}
        Specs: ${JSON.stringify(currentProduct.specifications)}
      `;
    }

    try {
      const res = await sendSupportChatMessage(updatedHistory, userMsg, productContext);
      setMessages((prev) => [...prev, { sender: 'model', text: res.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'model', text: 'Sorry, I encountered an issue reaching the server. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col h-[600px] overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bot className="w-6 h-6" />
                <div>
                  <h3 className="font-bold leading-tight">AI Support Agent</h3>
                  <span className="text-xs text-purple-200">
                    {currentProduct ? `Context: ${currentProduct.name}` : 'Powered by Gemini 2.5 Flash'}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-2 ${
                    m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      m.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-purple-600 text-white'
                    }`}
                  >
                    {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`max-w-[75%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      m.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center space-x-2 text-slate-400 text-xs">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce delay-100" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce delay-200" />
                  <span>Agent is analyzing specifications...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={currentProduct ? `Ask anything about ${currentProduct.name}...` : "Ask about products, orders, returns..."}
                className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50 shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};