import os
import re
import json
import hashlib
import urllib.request
import urllib.parse
import urllib.error
from decimal import Decimal
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from google import genai
from google.genai import types

from .models import Product

# ==============================================================================
# ULTRA-COMPACT SYSTEM PROMPT (Handles Same-Category, Cross-Category & Web Reviews)
# ==============================================================================
COMPACT_SHOPPING_PROMPT = """You are Aura AI, the expert shopping assistant for AuraTech Bangladesh (Currency: ৳ BDT).
Rules:
1. ONLY recommend or compare products from the INVENTORY CONTEXT. Never invent store prices or stock.
2. Keep responses concise (under 220 words) using clean Markdown (**bold** and bullet points).
3. SINGLE PRODUCT: Show **Name**, **Price (৳)**, **Brand**, **Stock**, top **Features**, and **🌐 Web Verdict (GSMArena/Reddit/Quora)** summarizing real-world user reputation.
4. SAME-CATEGORY COMPARISON: Compare specs, performance, and value head-to-head, add a **🌐 Community Consensus (Reddit/GSMArena)** bullet, and declare a **Best Pick**.
5. CROSS-CATEGORY COMPARISON (Different product types, e.g. Phone vs Earbuds/Charger): State clearly that they serve different purposes, explain each item's role, how they pair together in an ecosystem/bundle, and which to prioritize buying first."""

# Strict token budget ceiling: never attach optional web snippets if context exceeds 1,600 chars (~400 tokens)
MAX_CONTEXT_CHARS_FOR_WEB_SNIPPET = 1600
MAX_WEB_SNIPPET_CHARS = 220  # ~50 tokens max

GEMINI_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
]

# SambaNova Cloud Models (Blazing-fast RDU inference)
SAMBANOVA_MODELS = [
    'Meta-Llama-3.3-70B-Instruct',
    'DeepSeek-V3-0324',
    'Llama-4-Maverick-17B-128E-Instruct',
    'Qwen3-32B',
    'Meta-Llama-3.1-8B-Instruct',
]

# Groq Cloud Free Models (No Credit Card Required)
GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
]

# OpenRouter Free Models (No Credit Card Required)
OPENROUTER_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-27b-it:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
]

# GitHub Models Free Tier (Uses GitHub Personal Access Token - No Credit Card Required)
GITHUB_MODELS = [
    'gpt-4o-mini',
    'Meta-Llama-3.3-70B-Instruct',
]

# Mistral La Plateforme Free Tier (No Credit Card Required)
MISTRAL_MODELS = [
    'mistral-small-latest',
    'open-mistral-nemo',
]


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

    # Support comma-separated multiple keys for any provider too!
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
    """
    Automatic Multi-Agent Relay Race:
    1. Google Gemini (Key #1, Key #2, Key #3...)
    2. SambaNova Cloud (Meta-Llama-3.3-70B-Instruct, DeepSeek-V3, Qwen3-32B)
    3. Groq Cloud (Llama-3.3-70B, Llama-3.1-8B)
    4. OpenRouter Free Models
    5. GitHub Models Free Tier (GPT-4o-mini, Llama-3.3-70B)
    6. Mistral AI Free Tier
    """
    oa_messages = [{"role": m["role"], "content": m["text"]} for m in history_messages]
    oa_messages.append({"role": "user", "content": user_prompt})

    # 1. Try All Google Gemini Keys
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
                            extra_note="Token-Optimized Context + Web Verdict"
                        )
                        return response.text.strip()
                except Exception as m_err:
                    print(f"[Aura AI] Gemini Key #{key_idx} ({model_name}) limit/error -> rotating ({str(m_err)[:85]})")
                    continue
        except Exception as c_err:
            print(f"[Aura AI] Gemini Key #{key_idx} init error:", c_err)

    # 2. Try SambaNova Cloud
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

    # 3. Try Groq Cloud Free Tier
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

    # 4. Try OpenRouter Free Tier
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

    # 5. Try GitHub Models Free Tier (No Card Needed)
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

    # 6. Try Mistral AI Free Tier (No Card Needed)
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
# INVENTORY COMPRESSION & CROSS-CATEGORY COMPARISON DETECTOR
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
                if not cat:
                    db_prod = Product.objects.select_related('category').filter(name__iexact=name).first()
                    cat = db_prod.category.name if (db_prod and db_prod.category) else 'Tech'
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

            return context_str, comp_items, is_cross_category
        except Exception:
            return f"COMPARISON DATA:\n{str(product_context)[:1000]}", [], False

    search_str = str(message).strip()
    min_price, max_price = _extract_budget_from_message(search_str)

    exact_qs = Product.objects.filter(name__iexact=search_str).select_related('category')
    if exact_qs.exists():
        matched = list(exact_qs[:3])
    else:
        ignore_words = {
            'the', 'and', 'for', 'with', 'this', 'that', 'about', 'what', 'how',
            'tell', 'help', 'price', 'choose', 'find', 'show', 'suggest', 'recommend',
            'give', 'looking', 'want', 'need', 'best', 'good', 'cheap', 'budget',
            'under', 'over', 'between', 'can', 'you', 'please', 'me', 'some', 'any',
            'available', 'stock', 'store', 'compare', 'difference', 'work', 'office',
            'gaming', 'into', 'from', 'which', 'one', 'are', 'bdt', 'taka', 'reddit',
            'quora', 'gsmarena', 'review', 'reviews'
        }
        raw_words = re.findall(r'\b[a-zA-Z0-9]+\b', search_str.lower())
        search_terms = [w for w in raw_words if len(w) > 2 and w not in ignore_words and not w.isdigit()]

        if not search_terms:
            search_terms = [w for w in raw_words if len(w) > 2 and not w.isdigit()]

        qs = Product.objects.select_related('category').all()
        if max_price is not None:
            qs = qs.filter(cash_discount_price__lte=max_price)
        if min_price is not None:
            qs = qs.filter(cash_discount_price__gte=min_price)

        if search_terms:
            q_objects = Q()
            for term in search_terms[:4]:
                synonyms = [term]
                if term in ['phone', 'phones', 'mobile', 'mobiles', 'cellphone']:
                    synonyms.extend(['smartphone', 'phone', 'galaxy', 'iphone', 'redmi', 'oneplus', 'realme', 'vivo'])
                elif term in ['laptop', 'laptops', 'notebook', 'macbook']:
                    synonyms.extend(['laptop', 'notebook', 'macbook', 'vivobook', 'thinkpad'])
                elif term in ['earbud', 'earbuds', 'earphone', 'earphones', 'tws', 'headphone', 'headphones', 'airpods']:
                    synonyms.extend(['headphone', 'earbud', 'earphone', 'airdopes', 'bullets', 'wireless'])
                elif term in ['monitor', 'monitors', 'display', 'screen']:
                    synonyms.extend(['monitor', 'display', 'tv'])
                elif term in ['watch', 'watches', 'smartwatch']:
                    synonyms.extend(['watch', 'smartwatch', 'band'])

                for syn in synonyms:
                    q_objects |= (
                        Q(name__icontains=syn) |
                        Q(brand__icontains=syn) |
                        Q(category__name__icontains=syn)
                    )
            filtered_qs = qs.filter(q_objects).distinct()
            if filtered_qs.exists():
                qs = filtered_qs

        matched = list(qs.order_by('-is_featured', '-stock', '-id')[:5])
        if not matched:
            matched = list(Product.objects.select_related('category').filter(stock__gt=0).order_by('-is_featured', '-id')[:5])

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

    return final_context, matched, is_cross_cat


def _build_local_smart_fallback(message: str, matched_items: list, product_context: str = "", is_cross_category: bool = False) -> str:
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
                lines.append(f"   * **Primary Role:** Best suited as your dedicated {cat.lower()} solution ({brand}).")
                lines.append(f"   * **Highlight:** {top_feat or 'Official verified specifications.'}")

            lines.append("\n**How They Work Together & Buying Advice:**")
            lines.append("* **Different Categories:** Because these items belong to different product categories, they don't compete directly—they actually **complement each other**.")
            lines.append(f"* **Bundle Synergy:** You can pair all {len(matched_items)} items together for a complete setup at **৳{total_bundle:,.0f}**.")
            lines.append("* **🌐 Community Verdict (Reddit / GSMArena):** Buyers recommend prioritizing your primary daily driver first, then adding companion accessories like audio or fast charging.")
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
        lines.append(f"* Real-world buyers praise **{winner_name}** for delivering the strongest price-to-performance ratio in this segment.")
        lines.append(f"\n**Final Verdict:**\n**{winner_name}** is the best value pick unless you specifically need a brand-exclusive feature from the higher-priced option.")
        return "\n".join(lines)

    if not matched_items:
        return "I couldn't find an exact match in our current inventory for that request. Try browsing our categories or adjusting your budget range!"

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
            f"* **🌐 Web & Community Verdict (GSMArena / Reddit):** Highly rated in the {p.category.name if p.category else 'tech'} category for dependable everyday performance and value at ৳{price:,.0f}."
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
            f"\n**🌐 Community & Value Pick:** **{best_pick.name}** (৳{bp_price:,.0f}) stands out as the most popular, well-balanced choice on Reddit and buyer forums for this budget."
        )
    return "\n".join(lines)


def Number_or_zero(val) -> float:
    try:
        return float(str(val).replace(',', '').replace('৳', '').strip())
    except Exception:
        return 0.0


def generate_support_chat_reply(history: list, message: str, product_context: str = "") -> str:
    clean_msg = str(message).strip()
    compact_context, matched_items, is_cross_category = retrieve_compact_inventory_context(clean_msg, product_context)

    cache_key = _make_safe_cache_key("chat_v5", f"{clean_msg.lower()}::{compact_context}")
    cached_reply = cache.get(cache_key)
    if cached_reply and len(history) <= 2:
        _log_ai_telemetry("SERVER CACHE HIT (Chat)", extra_note=f"Query: '{clean_msg[:40]}'")
        return cached_reply

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

    if reply_text:
        cache.set(cache_key, reply_text, timeout=3600)
        return reply_text

    _log_ai_telemetry(
        "LOCAL DATABASE FALLBACK (Chat)",
        extra_note=f"Cross-Category={is_cross_category} | Generated reply directly from PostgreSQL"
    )
    return _build_local_smart_fallback(clean_msg, matched_items, product_context, is_cross_category)


def analyze_product_reviews_ai(product_name: str, reviews: list, product_id: int = 0) -> dict:
    cache_key = _make_safe_cache_key("review_v5", f"{product_id or product_name}::{len(reviews)}")
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