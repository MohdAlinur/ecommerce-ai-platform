import os
import re
import json
import hashlib
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q, F
from django.utils.text import slugify
from google import genai
from google.genai import types

from .models import Product, SupportKnowledgeBase, AIChatCacheEntry

# ==============================================================================
# ULTRA-COMPACT SYSTEM PROMPT (Strict Relevance — Never Suggest Unrelated Items)
# ==============================================================================
COMPACT_SHOPPING_PROMPT = """You are Aura AI, the official AI Shopping & Customer Service Assistant for AuraTech Bangladesh (Currency: ৳ BDT).
Rules:
1. STRICT RELEVANCE: ONLY recommend or compare products from INVENTORY CONTEXT that match the exact type of product the user asked for. NEVER suggest unrelated products or accessories (e.g., never suggest a power strip, cable, or adapter if the user asked for a graphics card, phone, or laptop).
2. STORE LINKS: Format recommended store product names in **Bold** so the system links them.
3. CUSTOMER SERVICE: For account, checkout, payment (Card, bKash, Nagad, COD), order tracking/cancellation, or warranty questions, give clear step-by-step instructions.
4. COMPARISONS:
   - Same Category: Compare specs & value head-to-head, add a **🌐 Web Verdict (GSMArena/Reddit)** bullet, and name a **Best Pick**.
   - Cross-Category (when user explicitly selects 2 different product types to compare): Explain each item's distinct purpose, how they work together, and which to buy first.
5. Keep replies under 200 words using clean Markdown (**bold** and bullet points)."""

MAX_CONTEXT_CHARS_FOR_WEB_SNIPPET = 1600
MAX_WEB_SNIPPET_CHARS = 220

GEMINI_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
]

SAMBANOVA_MODELS = [
    'Meta-Llama-3.3-70B-Instruct',
    'DeepSeek-V3-0324',
    'Llama-4-Maverick-17B-128E-Instruct',
    'Qwen3-32B',
    'Meta-Llama-3.1-8B-Instruct',
]

GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
]

OPENROUTER_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-27b-it:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
]

GITHUB_MODELS = [
    'gpt-4o-mini',
    'Meta-Llama-3.3-70B-Instruct',
]

MISTRAL_MODELS = [
    'mistral-small-latest',
    'open-mistral-nemo',
]

# ==============================================================================
# DEFAULT STEP-BY-STEP CUSTOMER SERVICE GUIDES (STORED IN POSTGRESQL = 0 TOKENS)
# ==============================================================================
DEFAULT_SUPPORT_GUIDES = [
    {
        "topic_slug": "create-account-login",
        "title": "How to Create an Account & Sign In",
        "keywords": "create account, sign up, signup, register, registration, open account, how to login, how to sign in, forgot password, google login, new account",
        "response_markdown": (
            "**How to Create an AuraTech Account (Step-by-Step):**\n"
            "1. Click the **Sign In** button at the top-right corner of the navigation bar.\n"
            "2. At the bottom of the popup modal, click **Create an account**.\n"
            "3. Enter your **Full Name**, **Email Address**, **Phone Number** (`017XXXXXXXX`), and optional **Default Delivery Address**.\n"
            "4. Set a secure **Password** (minimum 8 characters) and click **Create Account**.\n"
            "5. **Instant Google Sign-In:** You can also click **Continue with Google** for 1-click registration!\n\n"
            "* **Pro Tip:** Once registered, you can sign in anytime using your **Email**, **Phone Number**, or **Username**."
        )
    },
    {
        "topic_slug": "how-to-purchase-checkout",
        "title": "How to Purchase a Product & Complete Checkout",
        "keywords": "how to buy, how to purchase, how to order, place an order, checkout process, buying guide, step by step purchase, how do i buy, shopping bag, add to cart",
        "response_markdown": (
            "**How to Purchase a Product on AuraTech (Step-by-Step):**\n"
            "1. **Select Your Product:** Click **+ Add** on any product card, or open a product page to select your **Variation** (Color/RAM/Storage) and click **Buy Now**.\n"
            "2. **Review Shopping Bag:** Click the **Shopping Cart icon** at the top-right to review quantities or apply a **Promo Code**.\n"
            "3. **Step 1 — Delivery Info:** Click **Proceed to Checkout** and confirm your **Full Name**, **Email**, **Phone Number**, **Street Address**, and **City**.\n"
            "4. **Step 2 — Choose Payment Method:**\n"
            "   - **Credit / Debit Card:** Enter Cardholder Name, 16-digit Card Number, Expiry (`MM/YY`), and CVV.\n"
            "   - **bKash / Nagad:** Send payment to Merchant `01700-000000` and enter your Sender Phone & **Transaction ID (TrxID)**.\n"
            "   - **Cash on Delivery (COD):** Pay in cash when the parcel arrives at your doorstep.\n"
            "5. **Confirm & Invoice:** Click **Authorize & Pay** to receive your instant digital **Order Invoice** and Transaction ID!"
        )
    },
    {
        "topic_slug": "track-or-cancel-order",
        "title": "How to Track or Cancel an Order",
        "keywords": "track order, order status, cancel order, how to cancel, refund status, where is my order, order history, invoice, delivery tracking",
        "response_markdown": (
            "**How to Track or Cancel Your Order (Step-by-Step):**\n"
            "1. Sign in and click your **Profile Avatar** at the top-right -> select **My Account & Orders** (`/dashboard`).\n"
            "2. Click the **Orders & Invoices** tab on the left menu.\n"
            "3. **Live Tracking:** View your real-time status (**PENDING**, **PROCESSING**, **SHIPPED**, or **DELIVERED**), **Transaction ID**, and **Courier Tracking Number**.\n"
            "4. **How to Cancel:** If your order is still in **PENDING** or **PROCESSING** status, click the red **Cancel Order** button on the order card for an instant cancellation and automatic stock restoration."
        )
    },
    {
        "topic_slug": "payment-methods-emi-shipping",
        "title": "Payment Methods, EMI Plans & Delivery Charges",
        "keywords": "payment method, bkash, nagad, credit card, debit card, visa, mastercard, cash on delivery, cod, emi plan, installment, shipping fee, delivery charge, free delivery",
        "response_markdown": (
            "**AuraTech Payment Options & Delivery Policy:**\n"
            "* **Credit & Debit Cards:** 256-Bit SSL encrypted checkout for **Visa**, **Mastercard**, and **American Express**.\n"
            "* **Mobile Banking:** Instant verification for **bKash** and **Nagad** merchant payments.\n"
            "* **Cash on Delivery (COD):** Available nationwide across Bangladesh.\n"
            "* **0% EMI Plans:** Up to **12-Month 0% EMI** available on eligible products (selectable on the Product Detail page).\n"
            "* **Delivery Charges:** **FREE Delivery** on all orders of **৳5,000 or above** (৳120 standard delivery for orders below ৳5,000)."
        )
    },
    {
        "topic_slug": "compare-wishlist-promo",
        "title": "How to Compare Products, Use Wishlist & Promo Codes",
        "keywords": "how to compare, compare products, wishlist, save product, promo code, discount code, coupon code, apply discount",
        "response_markdown": (
            "**How to Use Compare, Wishlist & Promo Codes:**\n"
            "1. **Compare Products with AI:** Click the **Scale (Compare) icon** on up to 4 products -> click the Scale icon in the top header -> click **Compare with AI Agent** for a side-by-side verdict.\n"
            "2. **Save to Wishlist:** Click the **Bookmark icon** on any product card to save it to your **Saved Wishlist** inside `/dashboard`.\n"
            "3. **Apply Promo Codes:** Open your **Shopping Bag**, type your code in the **Promo / Discount Code** box, and click **Apply** before checkout."
        )
    },
    {
        "topic_slug": "warranty-returns-contact",
        "title": "Warranty, 7-Day Replacement & Customer Support Contact",
        "keywords": "warranty, return policy, replacement, refund policy, damaged product, customer support, contact number, phone number, helpline, hotline, customer care",
        "response_markdown": (
            "**Warranty, Returns & Concierge Support:**\n"
            "* **Official Warranty:** 100% authentic hardware backed by official brand warranty.\n"
            "* **7-Day Easy Replacement:** Instant replacement within 7 days for any manufacturing defect.\n"
            "* **24/7 AI & Concierge Hotline:** Call **16793** or **+880 1700-000000** (10:00 AM – 8:00 PM) or chat here anytime!"
        )
    }
]


def ensure_default_support_kb():
    try:
        if SupportKnowledgeBase.objects.count() == 0:
            for item in DEFAULT_SUPPORT_GUIDES:
                SupportKnowledgeBase.objects.update_or_create(
                    topic_slug=item["topic_slug"],
                    defaults={
                        "title": item["title"],
                        "keywords": item["keywords"],
                        "response_markdown": item["response_markdown"],
                        "is_active": True,
                    }
                )
    except Exception:
        pass


def match_customer_service_guide_from_db(message: str):
    clean_msg = re.sub(r'\s+', ' ', str(message).lower()).strip()
    if not clean_msg:
        return None

    if clean_msg in ['help', 'support', 'customer service', 'customer care', 'guide', 'how to use website']:
        return (
            "**AuraTech Customer Service Center — How can I help you today?**\n"
            "Ask me about any of these topics for an instant step-by-step guide:\n"
            "1. **How to create an account & sign in**\n"
            "2. **How to purchase a product & complete checkout**\n"
            "3. **Payment methods (Card, bKash, Nagad, COD & EMI)**\n"
            "4. **How to track or cancel an order**\n"
            "5. **How to compare products or apply promo codes**\n"
            "6. **Warranty, 7-day replacement & support hotline**"
        )

    try:
        ensure_default_support_kb()
        entries = list(SupportKnowledgeBase.objects.filter(is_active=True))
    except Exception:
        entries = []

    best_entry = None
    best_score = 0

    for entry in entries:
        phrases = [kw.strip().lower() for kw in entry.keywords.split(',') if kw.strip()]
        score = 0
        for phrase in phrases:
            if phrase in clean_msg:
                score += len(phrase.split()) * 3
        if score > best_score:
            best_score = score
            best_entry = entry

    if best_entry and best_score >= 3:
        try:
            SupportKnowledgeBase.objects.filter(id=best_entry.id).update(hit_count=F('hit_count') + 1)
        except Exception:
            pass
        return best_entry.response_markdown

    return None


def _make_safe_cache_key(prefix: str, raw_identifier: str) -> str:
    digest = hashlib.md5(raw_identifier.encode('utf-8')).hexdigest()
    return f"aura_{prefix}_{digest}"


def _log_ai_telemetry(source: str, model_name: str = "N/A", in_tok: int = 0, out_tok: int = 0, extra_note: str = ""):
    print("\n" + "=" * 72)
    print(f"[AURA AI ROUTER] Provider: {source} | Model: {model_name}")
    if in_tok or out_tok:
        print(f"  -> Input Tokens : {in_tok}")
        print(f"  -> Output Tokens: {out_tok}")
        print(f"  -> Total Tokens : {in_tok + out_tok} (Strict Free-Tier Budget Active)")
    else:
        print("  -> Total Tokens : 0 (Zero API Quota Consumed)")
    if extra_note:
        print(f"  -> Note         : {extra_note}")
    print("=" * 72 + "\n")


def _get_all_gemini_keys() -> list:
    raw_keys = [
        getattr(settings, 'GEMINI_API_KEY', None) or os.getenv('GEMINI_API_KEY', ''),
        getattr(settings, 'GEMINI_API_KEY_2', None) or os.getenv('GEMINI_API_KEY_2', ''),
        getattr(settings, 'GEMINI_API_KEY_3', None) or os.getenv('GEMINI_API_KEY_3', ''),
        os.getenv('GEMINI_API_KEYS', ''),
    ]
    keys = []
    for entry in raw_keys:
        if entry:
            for part in str(entry).split(','):
                clean = part.strip()
                if clean and clean not in keys:
                    keys.append(clean)
    return keys


def _strip_html(text: str) -> str:
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', str(text))
    return re.sub(r'\s+', ' ', clean).strip()


# ==============================================================================
# CLICKABLE STORE PRODUCT LINK INJECTOR & DIRECT EXTERNAL PRODUCT LINK RESOLVER
# ==============================================================================
def _inject_clickable_product_links(reply_text: str, matched_items: list) -> str:
    if not reply_text or not matched_items:
        return reply_text

    product_pairs = []
    for item in matched_items:
        if isinstance(item, Product):
            product_pairs.append((item.id, item.name))
        elif isinstance(item, dict) and item.get('id') and item.get('name'):
            product_pairs.append((item['id'], item['name']))
        elif isinstance(item, dict) and item.get('name'):
            db_p = Product.objects.filter(name__iexact=item['name']).only('id', 'name').first()
            if db_p:
                product_pairs.append((db_p.id, db_p.name))

    product_pairs.sort(key=lambda x: len(x[1]), reverse=True)

    updated_text = reply_text
    for pid, pname in product_pairs:
        if not pname or len(pname) < 3:
            continue
        url = f"/product/{pid}/{slugify(pname)}"
        if url in updated_text:
            continue

        bold_pattern = re.compile(r'\*\*\s*' + re.escape(pname) + r'\s*\*\*', re.IGNORECASE)
        if bold_pattern.search(updated_text):
            updated_text = bold_pattern.sub(f"[{pname}]({url})", updated_text)
        else:
            plain_pattern = re.compile(r'(?<!\[)\b' + re.escape(pname) + r'\b(?!\])', re.IGNORECASE)
            updated_text = plain_pattern.sub(f"[{pname}]({url})", updated_text, count=1)

    return updated_text


def _resolve_single_direct_product_link(site_filter: str, query: str, required_url_substrings: list, fallback_url: str, store_label: str) -> str:
    ddg_query = f"{site_filter} {query}"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(ddg_query)}"
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            }
        )
        with urllib.request.urlopen(req, timeout=1.6) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        matches = re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, flags=re.DOTALL)
        for raw_href, raw_title in matches[:5]:
            resolved_url = raw_href
            uddg_match = re.search(r'[?&]uddg=([^&]+)', raw_href)
            if uddg_match:
                resolved_url = urllib.parse.unquote(uddg_match.group(1))

            if any(sub in resolved_url.lower() for sub in required_url_substrings):
                clean_title = _strip_html(raw_title)
                clean_title = re.sub(r'\s*[-|–].*$', '', clean_title).strip()[:40] or query
                return f"* [{store_label}: {clean_title}]({resolved_url})"
    except Exception:
        pass

    return f"* [Find {query} on {store_label}]({fallback_url})"


def _build_external_marketplace_links_markdown(search_query: str) -> str:
    clean_q = re.sub(r'[^\w\s\-\+]', ' ', str(search_query)).strip()
    clean_q = re.sub(r'\s+', ' ', clean_q)[:55] or "tech gadget"

    cache_key = _make_safe_cache_key("direct_ext_links_v4", clean_q.lower())
    cached_block = cache.get(cache_key)
    if cached_block:
        return cached_block

    encoded_q = urllib.parse.quote_plus(clean_q)
    daraz_fallback = f"https://www.daraz.com.bd/catalog/?q={encoded_q}"
    amazon_fallback = f"https://www.amazon.com/s?k={encoded_q}"
    alibaba_fallback = f"https://www.alibaba.com/trade/search?SearchText={encoded_q}"

    tasks = [
        ("site:daraz.com.bd/products/", clean_q, ["daraz.com.bd/products/"], daraz_fallback, "Daraz BD"),
        ("site:amazon.com", clean_q, ["amazon.com/", "/dp/", "/gp/product/"], amazon_fallback, "Amazon"),
        ("site:alibaba.com/product-detail/", clean_q, ["alibaba.com/product-detail/"], alibaba_fallback, "Alibaba"),
    ]

    try:
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(_resolve_single_direct_product_link, *t) for t in tasks]
            resolved_lines = [f.result(timeout=2.0) for f in futures]
    except Exception:
        resolved_lines = [
            f"* [Find {clean_q} on Daraz BD]({daraz_fallback})",
            f"* [Find {clean_q} on Amazon]({amazon_fallback})",
            f"* [Find {clean_q} on Alibaba]({alibaba_fallback})",
        ]

    block = (
        f"\n\n**🌐 Check Direct Links on External Marketplaces for \"{clean_q}\":**\n"
        + "\n".join(resolved_lines)
    )
    cache.set(cache_key, block, timeout=604800)
    return block


# ==============================================================================
# TOKEN-SAFE WEB SNIPPET FETCHER (Reddit / Quora / GSMArena <= 50 Tokens)
# ==============================================================================
def _fetch_compact_web_consensus(product_names: list) -> str:
    if not product_names:
        return ""

    query_subject = " vs ".join([str(n)[:35] for n in product_names[:2]])
    cache_key = _make_safe_cache_key("web_snip_v1", query_subject.lower())
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    search_query = f"{query_subject} review site:gsmarena.com OR site:reddit.com OR site:quora.com"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(search_query)}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        snippets = re.findall(r'class="result__snippet[^>]*>(.*?)</a>', html, flags=re.DOTALL)
        cleaned = []
        for s in snippets[:2]:
            txt = _strip_html(s)
            if txt and len(txt) > 20:
                cleaned.append(txt[:110])

        final_snip = " | ".join(cleaned)[:MAX_WEB_SNIPPET_CHARS]
        cache.set(cache_key, final_snip, timeout=86400)
        return final_snip
    except Exception:
        cache.set(cache_key, "", timeout=3600)
        return ""


# ==============================================================================
# MULTI-PROVIDER OPENAI-COMPATIBLE CALLER (SambaNova, Groq, OpenRouter, GitHub, Mistral)
# ==============================================================================
def _call_openai_compatible_provider(
    provider_name: str,
    endpoint_url: str,
    api_key: str,
    models: list,
    system_prompt: str,
    messages: list,
    max_tokens: int = 380,
    json_mode: bool = False
):
    if not api_key or not str(api_key).strip():
        return None

    provider_keys = [k.strip() for k in str(api_key).split(',') if k.strip()]

    for key_idx, current_key in enumerate(provider_keys, 1):
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {current_key}",
            "User-Agent": "AuraTech-Ecommerce-AI/1.0",
        }
        if "OpenRouter" in provider_name:
            headers["HTTP-Referer"] = "http://localhost:5173"
            headers["X-Title"] = "AuraTech Smart Store"

        api_messages = [{"role": "system", "content": system_prompt}] + messages

        for model_name in models:
            payload = {
                "model": model_name,
                "messages": api_messages,
                "max_tokens": max_tokens,
                "temperature": 0.3,
            }
            if json_mode and "OpenRouter" not in provider_name:
                payload["response_format"] = {"type": "json_object"}

            try:
                req = urllib.request.Request(
                    endpoint_url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=8.5) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    reply = data["choices"][0]["message"]["content"].strip()
                    usage = data.get("usage", {})
                    label = f"{provider_name} (Key #{key_idx})" if len(provider_keys) > 1 else provider_name
                    _log_ai_telemetry(
                        label,
                        model_name=model_name,
                        in_tok=usage.get("prompt_tokens", 0),
                        out_tok=usage.get("completion_tokens", 0),
                        extra_note="Multi-Agent Failover Active"
                    )
                    return reply
            except Exception as err:
                print(f"[Aura AI] {provider_name} ({model_name}) skipped -> trying next ({str(err)[:90]})")
                continue

    return None


def _call_multi_agent_llm(system_prompt: str, history_messages: list, user_prompt: str, max_tokens: int = 380, json_mode: bool = False):
    oa_messages = [{"role": m["role"], "content": m["text"]} for m in history_messages]
    oa_messages.append({"role": "user", "content": user_prompt})

    # 1. Google Gemini Keys
    gemini_keys = _get_all_gemini_keys()
    for key_idx, g_key in enumerate(gemini_keys, 1):
        try:
            client = genai.Client(api_key=g_key)
            gemini_contents = [
                types.Content(
                    role="user" if m["role"] == "user" else "model",
                    parts=[types.Part.from_text(text=m["text"])]
                )
                for m in history_messages
            ]
            gemini_contents.append(
                types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
            )

            for model_name in GEMINI_MODELS:
                try:
                    config_kwargs = {
                        "system_instruction": system_prompt,
                        "max_output_tokens": max_tokens,
                        "temperature": 0.3,
                    }
                    if json_mode:
                        config_kwargs["response_mime_type"] = "application/json"
                    if hasattr(types, 'AutomaticFunctionCallingConfig'):
                        config_kwargs["automatic_function_calling"] = types.AutomaticFunctionCallingConfig(disable=True)

                    response = client.models.generate_content(
                        model=model_name,
                        contents=gemini_contents,
                        config=types.GenerateContentConfig(**config_kwargs)
                    )
                    if response and response.text:
                        usage = getattr(response, 'usage_metadata', None)
                        in_tok = getattr(usage, 'prompt_token_count', 0) or 0
                        out_tok = getattr(usage, 'candidates_token_count', 0) or 0
                        _log_ai_telemetry(
                            f"Google Gemini (Key #{key_idx})",
                            model_name=model_name,
                            in_tok=in_tok,
                            out_tok=out_tok,
                            extra_note="Token-Optimized Context + Clickable Links"
                        )
                        return response.text.strip()
                except Exception as m_err:
                    print(f"[Aura AI] Gemini Key #{key_idx} ({model_name}) limit/error -> rotating ({str(m_err)[:85]})")
                    continue
        except Exception as c_err:
            print(f"[Aura AI] Gemini Key #{key_idx} init error:", c_err)

    # 2. SambaNova Cloud
    sambanova_key = getattr(settings, 'SAMBANOVA_API_KEY', None) or os.getenv('SAMBANOVA_API_KEY', '')
    sn_reply = _call_openai_compatible_provider(
        provider_name="SambaNova Cloud",
        endpoint_url="https://api.sambanova.ai/v1/chat/completions",
        api_key=sambanova_key,
        models=SAMBANOVA_MODELS,
        system_prompt=system_prompt,
        messages=oa_messages,
        max_tokens=max_tokens,
        json_mode=json_mode
    )
    if sn_reply:
        return sn_reply

    # 3. Groq Cloud Free Tier
    groq_key = getattr(settings, 'GROQ_API_KEY', None) or os.getenv('GROQ_API_KEY', '')
    groq_reply = _call_openai_compatible_provider(
        provider_name="Groq Cloud (Free Tier)",
        endpoint_url="https://api.groq.com/openai/v1/chat/completions",
        api_key=groq_key,
        models=GROQ_MODELS,
        system_prompt=system_prompt,
        messages=oa_messages,
        max_tokens=max_tokens,
        json_mode=json_mode
    )
    if groq_reply:
        return groq_reply

    # 4. OpenRouter Free Tier
    openrouter_key = getattr(settings, 'OPENROUTER_API_KEY', None) or os.getenv('OPENROUTER_API_KEY', '')
    or_reply = _call_openai_compatible_provider(
        provider_name="OpenRouter (Free Models)",
        endpoint_url="https://openrouter.ai/api/v1/chat/completions",
        api_key=openrouter_key,
        models=OPENROUTER_MODELS,
        system_prompt=system_prompt,
        messages=oa_messages,
        max_tokens=max_tokens,
        json_mode=json_mode
    )
    if or_reply:
        return or_reply

    # 5. GitHub Models Free Tier
    github_key = getattr(settings, 'GITHUB_MODELS_KEY', None) or os.getenv('GITHUB_MODELS_KEY', '')
    gh_reply = _call_openai_compatible_provider(
        provider_name="GitHub Models (Free Tier)",
        endpoint_url="https://models.inference.ai.azure.com/chat/completions",
        api_key=github_key,
        models=GITHUB_MODELS,
        system_prompt=system_prompt,
        messages=oa_messages,
        max_tokens=max_tokens,
        json_mode=json_mode
    )
    if gh_reply:
        return gh_reply

    # 6. Mistral AI Free Tier
    mistral_key = getattr(settings, 'MISTRAL_API_KEY', None) or os.getenv('MISTRAL_API_KEY', '')
    ms_reply = _call_openai_compatible_provider(
        provider_name="Mistral AI (Free Tier)",
        endpoint_url="https://api.mistral.ai/v1/chat/completions",
        api_key=mistral_key,
        models=MISTRAL_MODELS,
        system_prompt=system_prompt,
        messages=oa_messages,
        max_tokens=max_tokens,
        json_mode=json_mode
    )
    if ms_reply:
        return ms_reply

    return None


# ==============================================================================
# STRICT RELEVANCE INVENTORY FILTER (Never Returns Irrelevant Products!)
# ==============================================================================
def _compress_product_for_prompt(p: Product) -> str:
    cat_name = p.category.name if p.category else "General"
    brand = p.brand or "AuraTech"
    price = p.cash_discount_price or p.regular_price or 0
    reg_price = p.regular_price or price
    discount_str = f" (Was ৳{reg_price})" if reg_price > price else ""
    stock_str = f"In Stock ({p.stock})" if p.stock > 0 else "Out of Stock"

    feats = []
    if isinstance(p.key_features, list):
        for f in p.key_features[:3]:
            f_clean = _strip_html(str(f))[:65]
            if f_clean:
                feats.append(f_clean)

    specs = []
    if isinstance(p.specifications, list):
        for group in p.specifications:
            if isinstance(group, dict):
                items = group.get('features') or group.get('attributes') or []
                for item in items:
                    if isinstance(item, dict):
                        k = str(item.get('key') or item.get('name') or '').strip()
                        v = _strip_html(str(item.get('value') or ''))[:40]
                        if k and v and v.lower() != 'nan':
                            specs.append(f"{k}: {v}")
                            if len(specs) >= 3:
                                break
            if len(specs) >= 3:
                break

    details = " | ".join(feats + specs) or _strip_html(p.description)[:100]
    return f"[{p.name}] Cat:{cat_name} | Brand:{brand} | ৳{price}{discount_str} | {stock_str} | {details}"


def _extract_budget_from_message(message: str):
    msg = message.lower().replace(',', '')
    max_price = None
    min_price = None

    under_match = re.search(r'(?:under|below|within|less than|max|budget|upto|up to|<)\s*৳?\s*(\d+(?:\.\d+)?)\s*(k)?', msg)
    if under_match:
        val = float(under_match.group(1))
        if under_match.group(2) == 'k':
            val *= 1000
        max_price = Decimal(str(val))

    over_match = re.search(r'(?:over|above|more than|min|>)\s*৳?\s*(\d+(?:\.\d+)?)\s*(k)?', msg)
    if over_match:
        val = float(over_match.group(1))
        if over_match.group(2) == 'k':
            val *= 1000
        min_price = Decimal(str(val))

    return min_price, max_price


def retrieve_compact_inventory_context(message: str, product_context: str = ""):
    """
    Strictly matches products in the database.
    If the requested product or product category does NOT exist in the database,
    returns `matched = []` and `is_product_missing = True` so Aura AI NEVER
    suggests irrelevant products!
    """
    if product_context and "comparison_data" in str(product_context):
        try:
            parsed = json.loads(product_context)
            comp_items = parsed.get("comparison_data", [])
            lines = []
            categories_seen = set()
            product_names = []

            for item in comp_items[:4]:
                name = item.get('name', 'Product')
                product_names.append(name)
                brand = item.get('brand') or 'AuraTech'
                price = item.get('price') or 0
                cat = item.get('category') or ''
                db_prod = Product.objects.select_related('category').filter(name__iexact=name).first()
                if db_prod:
                    item['id'] = db_prod.id
                    if not cat and db_prod.category:
                        cat = db_prod.category.name
                cat = cat or 'Tech'
                item['category'] = cat
                categories_seen.add(cat.lower().strip())

                feats = item.get('features') or []
                feat_str = "; ".join([str(f)[:55] for f in feats[:3]]) if isinstance(feats, list) else ""
                desc_str = _strip_html(item.get('description', ''))[:90]
                lines.append(f"[{name}] Category:{cat} | Brand:{brand} | ৳{price} | {feat_str or desc_str}")

            is_cross_category = len(categories_seen) > 1
            mode_header = (
                "COMPARISON TYPE: CROSS-CATEGORY (Different product types! Explain each item's distinct use-case, how they pair together as a bundle/ecosystem, and which to buy first based on budget).\n"
                if is_cross_category else
                "COMPARISON TYPE: SAME-CATEGORY HEAD-TO-HEAD (Compare specs, value, and declare a clear winner).\n"
            )
            context_str = mode_header + "ITEMS:\n" + "\n".join(lines)

            if len(context_str) < MAX_CONTEXT_CHARS_FOR_WEB_SNIPPET:
                web_snip = _fetch_compact_web_consensus(product_names)
                if web_snip:
                    context_str += f"\nWEB SNIPPET (GSMArena/Reddit): {web_snip}"

            return context_str, comp_items, is_cross_category, False, ""
        except Exception:
            return f"COMPARISON DATA:\n{str(product_context)[:1000]}", [], False, False, ""

    search_str = str(message).strip()
    min_price, max_price = _extract_budget_from_message(search_str)

    # Remove budget phrase (e.g. "under ৳100,000", "below 50k") before tokenizing so numbers don't pollute model matching
    cleaned_for_tokens = re.sub(
        r'(?:under|below|within|less than|max|budget|upto|up to|over|above|more than|min|<|>)\s*৳?\s*\d+(?:[.,]\d+)?\s*k?',
        ' ',
        search_str.lower()
    )

    ignore_words = {
        'the', 'and', 'for', 'with', 'this', 'that', 'about', 'what', 'how',
        'tell', 'help', 'price', 'choose', 'find', 'show', 'suggest', 'recommend',
        'give', 'looking', 'want', 'need', 'best', 'good', 'cheap', 'budget',
        'under', 'over', 'between', 'can', 'you', 'please', 'me', 'some', 'any',
        'available', 'stock', 'store', 'compare', 'difference', 'work', 'office',
        'gaming', 'into', 'from', 'which', 'one', 'are', 'bdt', 'taka', 'reddit',
        'quora', 'gsmarena', 'review', 'reviews', 'have', 'buy', 'get', 'does',
        'your', 'do', 'is', 'in', 'at', 'auratech', 'bangladesh', 'there', 'card'
    }

    # Map category/type synonyms strictly (no loose words like 'display' or 'card' that cause false positives)
    category_synonyms = {
        'phone': ['smartphone', 'phone', 'smartphones'],
        'phones': ['smartphone', 'phone', 'smartphones'],
        'mobile': ['smartphone', 'phone', 'smartphones'],
        'mobiles': ['smartphone', 'phone', 'smartphones'],
        'smartphone': ['smartphone', 'phone', 'smartphones'],
        'smartphones': ['smartphone', 'phone', 'smartphones'],
        'laptop': ['laptop', 'laptops', 'notebook', 'macbook', 'vivobook'],
        'laptops': ['laptop', 'laptops', 'notebook', 'macbook', 'vivobook'],
        'notebook': ['laptop', 'laptops', 'notebook'],
        'earbud': ['earbud', 'earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'airdopes', 'bullets', 'tws'],
        'earbuds': ['earbud', 'earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'airdopes', 'bullets', 'tws'],
        'earphone': ['earbud', 'earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'airdopes', 'bullets'],
        'earphones': ['earbud', 'earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'airdopes', 'bullets'],
        'tws': ['earbud', 'earbuds', 'headphone', 'headphones', 'airdopes'],
        'headphone': ['headphone', 'headphones', 'earbud', 'earbuds', 'earphone'],
        'headphones': ['headphone', 'headphones', 'earbud', 'earbuds', 'earphone'],
        'watch': ['smartwatch', 'smartwatches', 'watch'],
        'watches': ['smartwatch', 'smartwatches', 'watch'],
        'smartwatch': ['smartwatch', 'smartwatches', 'watch'],
        'smartwatches': ['smartwatch', 'smartwatches', 'watch'],
        'monitor': ['monitor', 'monitors'],
        'monitors': ['monitor', 'monitors'],
        'tv': ['smart tv', 'television', 'tv'],
        'television': ['smart tv', 'television', 'tv'],
        'camera': ['camera', 'cameras', 'photography'],
        'cameras': ['camera', 'cameras', 'photography'],
        'gpu': ['graphics card', 'gpu', 'rtx', 'gtx', 'radeon'],
        'graphics': ['graphics card', 'gpu', 'rtx', 'gtx', 'radeon'],
    }

    raw_words = re.findall(r'\b[a-zA-Z0-9\+]+\b', cleaned_for_tokens)
    search_terms = [w for w in raw_words if len(w) > 1 and w not in ignore_words]

    # Separate generic category words from specific brand/model words (e.g. 'rtx', '4060', 'ps5', 'iphone', 'redmi')
    requested_categories = [w for w in search_terms if w in category_synonyms]
    specific_model_terms = [w for w in search_terms if w not in category_synonyms]

    # Build clean external query string for Daraz/Amazon/Alibaba links
    external_query_words = [w for w in re.findall(r'\b[a-zA-Z0-9\+]+\b', cleaned_for_tokens) if w not in (ignore_words - {'card', 'gaming', 'office'})]
    external_query = " ".join(external_query_words)[:50] or search_str[:45]

    qs = Product.objects.select_related('category').all()
    if max_price is not None:
        qs = qs.filter(cash_discount_price__lte=max_price)
    if min_price is not None:
        qs = qs.filter(cash_discount_price__gte=min_price)

    # 1. If the user mentioned a product type/category (e.g. laptop, monitor, graphics, phone),
    #    the product MUST match that category/type in its name or category_name!
    if requested_categories:
        cat_q = Q()
        for cat_word in requested_categories:
            for syn in category_synonyms[cat_word]:
                cat_q |= Q(name__icontains=syn) | Q(category__name__icontains=syn)
        qs = qs.filter(cat_q).distinct()

    # 2. If the user mentioned specific model/brand terms (e.g. "RTX 4060", "PS5", "Redmi 10", "iPhone 16"),
    #    ALL specific model terms must match the product's name, brand, or product_code!
    if specific_model_terms:
        strict_model_q = Q()
        for sterm in specific_model_terms[:4]:
            strict_model_q &= (
                Q(name__icontains=sterm) |
                Q(brand__icontains=sterm) |
                Q(product_code__icontains=sterm)
            )
        qs = qs.filter(strict_model_q).distinct()

    # 3. If neither category nor model terms were extracted (e.g. general greeting), don't mark missing
    if not requested_categories and not specific_model_terms:
        matched = list(qs.filter(stock__gt=0).order_by('-is_featured', '-id')[:4])
        is_product_missing = False
    else:
        matched = list(qs.order_by('-is_featured', '-stock', '-id')[:5])
        is_product_missing = len(matched) == 0

    if is_product_missing:
        # DO NOT load random or unrelated products when the requested product/type doesn't exist!
        return "", [], False, True, external_query

    categories_found = {p.category.name for p in matched if p.category}
    is_cross_cat = len(categories_found) > 1 and ('compare' in search_str.lower() or ' vs ' in search_str.lower())

    context_lines = [_compress_product_for_prompt(p) for p in matched]
    final_context = "INVENTORY CONTEXT:\n" + "\n".join(context_lines)

    if product_context:
        final_context += f"\nCURRENTLY VIEWING:\n{_strip_html(str(product_context))[:300]}"

    if len(matched) <= 2 and len(final_context) < MAX_CONTEXT_CHARS_FOR_WEB_SNIPPET:
        web_snip = _fetch_compact_web_consensus([p.name for p in matched[:2]])
        if web_snip:
            final_context += f"\nWEB SNIPPET (GSMArena/Reddit): {web_snip}"

    return final_context, matched, is_cross_cat, False, external_query


def _build_local_smart_fallback(
    message: str,
    matched_items: list,
    product_context: str = "",
    is_cross_category: bool = False,
    is_product_missing: bool = False,
    external_query: str = ""
) -> str:
    if is_product_missing or not matched_items:
        return (
            f"We currently don't have **{external_query or 'that product'}** available in our AuraTech store inventory."
        )

    if product_context and "comparison_data" in str(product_context) and matched_items:
        if is_cross_category:
            lines = ["**Cross-Category Comparison (Different Product Types):**\n"]
            total_bundle = 0.0
            for idx, item in enumerate(matched_items, 1):
                name = item.get('name', f'Product {idx}')
                cat = item.get('category') or 'Tech'
                brand = item.get('brand') or 'AuraTech'
                price = Number_or_zero(item.get('price'))
                total_bundle += price
                feats = item.get('features') or []
                top_feat = _strip_html(str(feats[0]))[:75] if isinstance(feats, list) and feats else _strip_html(item.get('description', ''))[:75]
                lines.append(f"{idx}. **{name}** (*{cat}*) — **৳{price:,.0f}**")
                lines.append(f"   * **Primary Role:** Dedicated {cat.lower()} solution ({brand}).")
                lines.append(f"   * **Highlight:** {top_feat or 'Official verified specifications.'}")

            lines.append("\n**How They Work Together & Buying Advice:**")
            lines.append("* **Complementary Setup:** Because these items belong to different categories, they work together rather than competing.")
            lines.append(f"* **Bundle Total:** Pair all {len(matched_items)} items together for **৳{total_bundle:,.0f}**.")
            lines.append("* **🌐 Community Verdict (Reddit / GSMArena):** Prioritize your primary daily device first, then add companion accessories.")
            return "\n".join(lines)

        lines = ["**Head-to-Head Product Comparison:**"]
        best_item = None
        lowest_price = None

        for idx, item in enumerate(matched_items, 1):
            name = item.get('name', f'Product {idx}')
            price = Number_or_zero(item.get('price'))
            brand = item.get('brand') or 'AuraTech'
            cat = item.get('category') or 'Tech'
            lines.append(f"{idx}. **{name}** — **৳{price:,.0f}** ({brand} | {cat})")
            if lowest_price is None or (price > 0 and price < lowest_price):
                lowest_price = price
                best_item = item

        lines.append("\n**Key Differences & Specs:**")
        for item in matched_items:
            name = item.get('name', 'Product')
            feats = item.get('features') or []
            top_feat = _strip_html(str(feats[0]))[:85] if isinstance(feats, list) and len(feats) > 0 else _strip_html(item.get('description', ''))[:85]
            lines.append(f"* **{name}:** {top_feat or 'Standard manufacturer specifications.'}")

        winner_name = best_item.get('name') if best_item else matched_items[0].get('name')
        lines.append("\n**🌐 Web & Community Verdict (GSMArena / Reddit):**")
        lines.append(f"* Real-world buyers praise **{winner_name}** for delivering the strongest price-to-performance ratio.")
        lines.append(f"\n**Final Verdict:**\n**{winner_name}** is the best value pick.")
        return "\n".join(lines)

    if len(matched_items) == 1 and isinstance(matched_items[0], Product):
        p = matched_items[0]
        price = p.cash_discount_price or p.regular_price or 0
        feats = p.key_features[:3] if isinstance(p.key_features, list) else []
        feat_bullets = "\n".join([f"- {_strip_html(str(f))[:80]}" for f in feats]) or "- Official AuraTech verified hardware"
        return (
            f"**{p.name}**\n"
            f"* **Price:** ৳{price:,.0f}\n"
            f"* **Brand:** {p.brand or 'AuraTech'} ({p.category.name if p.category else 'General'})\n"
            f"* **Status:** {'In Stock' if p.stock > 0 else 'Out of Stock'}\n"
            f"* **Key Features:**\n{feat_bullets}\n"
            f"* **🌐 Web & Community Verdict (GSMArena / Reddit):** Highly rated in the {p.category.name if p.category else 'tech'} segment for reliable performance at ৳{price:,.0f}."
        )

    lines = ["Here are the top matching options currently available in our store:\n"]
    best_pick = matched_items[0]
    for idx, p in enumerate(matched_items[:4], 1):
        if isinstance(p, Product):
            price = p.cash_discount_price or p.regular_price or 0
            stock_badge = "In Stock" if p.stock > 0 else "Out of Stock"
            feat_preview = ""
            if isinstance(p.key_features, list) and len(p.key_features) > 0:
                feat_preview = f" — {_strip_html(str(p.key_features[0]))[:65]}"
            lines.append(f"{idx}. **{p.name}** — **৳{price:,.0f}** ({p.brand or p.category.name} | {stock_badge}){feat_preview}")

    if isinstance(best_pick, Product):
        bp_price = best_pick.cash_discount_price or best_pick.regular_price or 0
        lines.append(
            f"\n**🌐 Community & Value Pick:** **{best_pick.name}** (৳{bp_price:,.0f}) stands out as the most popular, well-balanced choice for this budget."
        )
    return "\n".join(lines)


def Number_or_zero(val) -> float:
    try:
        return float(str(val).replace(',', '').replace('৳', '').strip())
    except Exception:
        return 0.0


# ==============================================================================
# MAIN CHAT & REVIEW ENTRYPOINTS
# ==============================================================================
def generate_support_chat_reply(history: list, message: str, product_context: str = "") -> str:
    clean_msg = str(message).strip()

    # 1. Check PostgreSQL Customer Service Knowledge Base FIRST (0 API Tokens!)
    if not (product_context and "comparison_data" in str(product_context)):
        db_guide = match_customer_service_guide_from_db(clean_msg)
        if db_guide:
            _log_ai_telemetry(
                "POSTGRESQL KNOWLEDGE BASE (Customer Service Guide)",
                extra_note=f"Matched how-to guide for: '{clean_msg[:45]}'"
            )
            return db_guide

    compact_context, matched_items, is_cross_category, is_product_missing, external_query = (
        retrieve_compact_inventory_context(clean_msg, product_context)
    )

    # 2. If the requested product or product category does NOT exist in our store:
    #    Do NOT suggest irrelevant products and do NOT waste LLM tokens!
    #    Return a clean message + direct Daraz BD, Amazon, and Alibaba links immediately!
    if is_product_missing or not matched_items:
        _log_ai_telemetry(
            "DIRECT EXTERNAL MARKETPLACE RESOLVER (0 Tokens)",
            extra_note=f"Product/type '{external_query}' not in store -> returning external links only"
        )
        return (
            f"We currently don't have **{external_query}** in stock at AuraTech Bangladesh."
            + _build_external_marketplace_links_markdown(external_query)
        )

    cache_key = _make_safe_cache_key("chat_v9", f"{clean_msg.lower()}::{compact_context}")

    # 3. Check RAM Cache & PostgreSQL Persistent AI Cache (0 API Tokens!)
    if len(history) <= 2:
        cached_reply = cache.get(cache_key)
        if cached_reply:
            _log_ai_telemetry("RAM CACHE HIT (Chat)", extra_note=f"Query: '{clean_msg[:40]}'")
            return cached_reply

        try:
            db_cache = AIChatCacheEntry.objects.filter(cache_key=cache_key).first()
            if db_cache:
                AIChatCacheEntry.objects.filter(id=db_cache.id).update(hit_count=F('hit_count') + 1)
                cache.set(cache_key, db_cache.reply_markdown, timeout=3600)
                _log_ai_telemetry("POSTGRESQL AI CACHE HIT (Chat)", extra_note=f"Query: '{clean_msg[:40]}'")
                return db_cache.reply_markdown
        except Exception:
            pass

    normalized_history = []
    recent_history = history[-4:] if isinstance(history, list) else []
    for msg in recent_history:
        if not isinstance(msg, dict):
            continue
        raw_role = msg.get('role') or msg.get('sender') or 'user'
        role = "user" if raw_role == 'user' else "assistant"
        text_val = ""
        if 'parts' in msg and isinstance(msg['parts'], list) and len(msg['parts']) > 0:
            text_val = msg['parts'][0].get('text', '')
        elif 'text' in msg:
            text_val = msg.get('text', '')
        elif 'content' in msg:
            text_val = msg.get('content', '')

        text_trimmed = str(text_val).strip()[:220]
        if text_trimmed:
            normalized_history.append({"role": role, "text": text_trimmed})

    user_prompt = f"{compact_context}\n\nCUSTOMER QUESTION: {clean_msg[:280]}"

    reply_text = _call_multi_agent_llm(
        system_prompt=COMPACT_SHOPPING_PROMPT,
        history_messages=normalized_history,
        user_prompt=user_prompt,
        max_tokens=380,
        json_mode=False
    )

    if not reply_text:
        _log_ai_telemetry(
            "LOCAL DATABASE FALLBACK (Chat)",
            extra_note=f"CrossCat={is_cross_category}"
        )
        reply_text = _build_local_smart_fallback(
            clean_msg, matched_items, product_context, is_cross_category, False, external_query
        )

    # 4. Post-Process: Inject clickable store product links (/product/id/slug) at 0 tokens
    reply_text = _inject_clickable_product_links(reply_text, matched_items)

    # 5. Save to both RAM Cache & PostgreSQL Persistent Cache
    cache.set(cache_key, reply_text, timeout=3600)
    try:
        AIChatCacheEntry.objects.update_or_create(
            cache_key=cache_key,
            defaults={"question": clean_msg[:500], "reply_markdown": reply_text}
        )
    except Exception:
        pass

    return reply_text


def analyze_product_reviews_ai(product_name: str, reviews: list, product_id: int = 0) -> dict:
    cache_key = _make_safe_cache_key("review_v9", f"{product_id or product_name}::{len(reviews)}")
    cached_data = cache.get(cache_key)
    if cached_data:
        _log_ai_telemetry("SERVER CACHE HIT (Review Analysis)", extra_note=f"Product ID: {product_id}")
        return cached_data

    compact_reviews = "\n".join(
        [f"{r.get('rating', 5)}/5: {_strip_html(r.get('comment', ''))[:90]}" for r in reviews[:6]]
    ) if reviews else "No store reviews yet; summarize known GSMArena/Reddit reputation for this model."

    web_snip = _fetch_compact_web_consensus([product_name])
    web_line = f"\nWeb Consensus Snippet: {web_snip}" if web_snip else ""

    prompt = (
        f"Product: {product_name[:80]}\nStore Reviews:\n{compact_reviews}{web_line}\n"
        f"Return JSON with keys: summary (1-2 sentences combining store & GSMArena/Reddit reception), "
        f"sentiment_score (0-100 int), sentiment_label (Positive/Neutral/Negative), "
        f"key_strengths (max 3 short strings), areas_for_improvement (max 2 short strings)."
    )

    raw_json = _call_multi_agent_llm(
        system_prompt="You are a concise e-commerce product analyst. Output valid JSON only.",
        history_messages=[],
        user_prompt=prompt,
        max_tokens=240,
        json_mode=True
    )

    if raw_json:
        try:
            cleaned_json = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw_json.strip())
            result = json.loads(cleaned_json)
            cache.set(cache_key, result, timeout=86400)
            return result
        except Exception as e:
            print("[Aura Review AI] JSON parse fallback:", e)

    avg = sum(Number_or_zero(r.get('rating', 5)) for r in reviews) / max(len(reviews), 1) if reviews else 4.6
    fallback_result = {
        "summary": f"{product_name} holds a strong {avg:.1f}/5 rating from buyers and community reviewers for its dependable performance and value.",
        "sentiment_score": int((avg / 5.0) * 100),
        "sentiment_label": "Positive" if avg >= 4 else ("Neutral" if avg >= 2.5 else "Negative"),
        "key_strengths": ["Strong value for money", "Positive community & buyer reception"],
        "areas_for_improvement": []
    }
    cache.set(cache_key, fallback_result, timeout=3600)
    return fallback_result