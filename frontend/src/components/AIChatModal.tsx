import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, ExternalLink, ShoppingBag } from 'lucide-react';
import { sendSupportChatMessage } from '../api';
import { motion, AnimatePresence } from 'motion/react';
import type { Product } from '../types';

const modalChatCache = new Map<string, string>();

// Renders Markdown bolding, bullets, clickable internal product links, and external Daraz/Amazon/Alibaba buttons
function renderFormattedMarkdown(text: string, isUser: boolean = false) {
  const formatInline = (rawLine: string): React.ReactNode[] => {
    // Normalize **[Label](url)** into [Label](url)
    const normalized = rawLine.replace(/\*\*(\[[^\]]+\]\([^)]+\))\*\*/g, '$1');
    const tokens = normalized.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);

    return tokens.map((tok, idx) => {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const label = linkMatch[1].replace(/\*\*/g, '').trim();
        const url = linkMatch[2].trim();

        if (url.startsWith('/')) {
          return (
            <a
              key={idx}
              href={url}
              className={`inline-flex items-center gap-1 font-black underline underline-offset-2 transition ${
                isUser ? 'text-white hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-800'
              }`}
            >
              <ShoppingBag className="w-3 h-3 shrink-0 inline" />
              <span>{label}</span>
            </a>
          );
        }

        return (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 my-0.5 rounded-full text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition shadow-sm"
          >
            <span>{label}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        );
      }

      if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
        return (
          <strong key={idx} className={isUser ? 'font-black text-white' : 'font-black text-slate-900'}>
            {tok.slice(2, -2)}
          </strong>
        );
      }

      return <React.Fragment key={idx}>{tok}</React.Fragment>;
    });
  };

  const lines = (text || '').split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        const bulletMatch = trimmed.match(/^([*-•])\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isUser ? 'bg-indigo-200' : 'bg-indigo-600'}`} />
              <span className="flex-1 leading-relaxed">{formatInline(bulletMatch[2])}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className={`text-xs font-black mt-0.5 shrink-0 ${isUser ? 'text-indigo-200' : 'text-indigo-600'}`}>
                {numMatch[1]}.
              </span>
              <span className="flex-1 leading-relaxed">{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

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
        ? `Hello! I see you are looking at **${currentProduct.name}**. Ask me any technical questions, or ask how to order!`
        : 'Hello! I am your **AuraTech AI Shopping & Customer Service Assistant**. Ask me for product recommendations, how to create an account, or how to purchase!'
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sendingLockRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg || loading || cooldown > 0 || sendingLockRef.current) return;

    sendingLockRef.current = true;
    setInput('');
    const updatedHistory: ChatMessage[] = [...messages, { sender: 'user', text: userMsg }];
    setMessages(updatedHistory);

    const cacheKey = `${currentProduct?.id || 'global'}::${userMsg.toLowerCase()}`;
    const cachedReply = modalChatCache.get(cacheKey);
    if (cachedReply) {
      setMessages(prev => [...prev, { sender: 'model', text: cachedReply }]);
      sendingLockRef.current = false;
      return;
    }

    setLoading(true);

    let productContext = '';
    if (currentProduct) {
      productContext = `Viewing: ${currentProduct.name} | Brand: ${currentProduct.brand || 'AuraTech'} | Price: ৳${currentProduct.cash_discount_price} | Features: ${JSON.stringify((currentProduct.key_features || []).slice(0, 3))}`;
    }

    try {
      const formattedHistory = updatedHistory.slice(-4).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text.slice(0, 250) }]
      }));
      const res = await sendSupportChatMessage(formattedHistory, userMsg, productContext);
      if (res.reply) {
        modalChatCache.set(cacheKey, res.reply);
      }
      setMessages((prev) => [...prev, { sender: 'model', text: res.reply }]);
      setCooldown(3);
    } catch {
      setMessages((prev) => [...prev, { sender: 'model', text: 'Sorry, I encountered an issue reaching the server. Please try again.' }]);
    } finally {
      setLoading(false);
      sendingLockRef.current = false;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col h-[650px] overflow-hidden border border-slate-100"
          >
            <div className="p-6 bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-lg tracking-tight leading-tight">Aura AI Agent</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    {currentProduct ? `Context: ${currentProduct.name.substring(0, 25)}...` : 'Shopping & Customer Service'}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex items-start space-x-3 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${m.sender === 'user' ? 'bg-slate-200 border-slate-300' : 'bg-indigo-100 border-indigo-200 text-indigo-600'}`}>
                    {m.sender === 'user' ? <span className="text-xs font-bold text-slate-600">ME</span> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[80%] p-4 text-sm shadow-sm break-words ${m.sender === 'user' ? 'bg-slate-900 text-white rounded-2xl rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm'}`}>
                    {renderFormattedMarkdown(m.text, m.sender === 'user')}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center"><Bot className="w-4 h-4 text-indigo-600" /></div>
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-sm flex space-x-1.5 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-100" />
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-200" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex items-center gap-3 shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={cooldown > 0 ? `Please wait ${cooldown}s...` : currentProduct ? `Ask anything about this ${currentProduct.brand || 'product'}...` : 'Ask about products, how to buy, or account help...'}
                className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-slate-900 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={loading || cooldown > 0 || !input.trim()}
                className="p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl transition disabled:opacity-50 shadow-sm flex items-center justify-center min-w-[48px]"
              >
                {cooldown > 0 ? <span className="text-xs font-bold">{cooldown}s</span> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};