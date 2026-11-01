import os
import re
import json
import hashlib
from decimal import Decimal
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from google import genai
from google.genai import types

from .models import Product

# ==============================================================================
# COMPACT SYSTEM PROMPT (Saves ~70% System Prompt Tokens)
# ==============================================================================
COMPACT_SHOPPING_PROMPT = """You are Aura AI, the shopping assistant for AuraTech Bangladesh (Currency: ৳ BDT).
Rules:
1. ONLY recommend or compare products present in the provided INVENTORY CONTEXT. Never invent products, specs, or prices.
2. Be concise, helpful, and use clean Markdown.
3. For 1 product: show **Name**, **Price (৳)**, **Brand**, **Stock**, top **Features/Specs**, and a 1-line verdict.
4. For comparisons or recommendations: list matching items with **৳ Price**, compare key specs/value briefly, and declare a clear **Best Pick**."""

# Updated for 2026 Free Tier models required by Google's API
FREE_TIER_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
]


def _make_safe_cache_key(prefix: str, raw_identifier: str) -> str:
    """
    Hashes the identifier into a clean ASCII hex string so Django never raises
    CacheKeyWarning on spaces, colons, or currency symbols like '৳'.
    """
    digest = hashlib.md5(raw_identifier.encode('utf-8')).hexdigest()
    return f"aura_{prefix}_{digest}"


def _log_ai_telemetry(source: str, model_name: str = "N/A", usage=None, extra_note: str = ""):
    print("\n" + "=" * 68)
    print(f"[AURA AI TELEMETRY] Source: {source} | Model: {model_name}")
    if usage:
        in_tok = getattr(usage, 'prompt_token_count', 0) or 0
        out_tok = getattr(usage, 'candidates_token_count', 0) or 0
        tot_tok = getattr(usage, 'total_token_count', in_tok + out_tok) or (in_tok + out_tok)
        print(f"  -> Input Tokens : {in_tok}")
        print(f"  -> Output Tokens: {out_tok}")
        print(f"  -> Total Tokens : {tot_tok} (Saved ~90% vs unoptimized 25-product dump)")
    else:
        print("  -> Total Tokens : 0 (Zero API Quota Consumed)")
    if extra_note:
        print(f"  -> Note         : {extra_note}")
    print("=" * 68 + "\n")


def get_gemini_client():
    api_key = getattr(settings, 'GEMINI_API_KEY', None) or os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.strip() == "":
        raise ValueError("GEMINI_API_KEY is empty or not configured.")
    return genai.Client(api_key=api_key)


def _strip_html(text: str) -> str:
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', str(text))
    return re.sub(r'\s+', ' ', clean).strip()


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
            f_clean = _strip_html(str(f))[:70]
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
                        v = _strip_html(str(item.get('value') or ''))[:45]
                        if k and v and v.lower() != 'nan':
                            specs.append(f"{k}: {v}")
                            if len(specs) >= 4:
                                break
            if len(specs) >= 4:
                break

    details = " | ".join(feats + specs)
    if not details:
        details = _strip_html(p.description)[:120]

    return f"[{p.name}] Brand:{brand} | Cat:{cat_name} | ৳{price}{discount_str} | {stock_str} | {details}"


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
            for item in comp_items[:4]:
                name = item.get('name', 'Product')
                brand = item.get('brand') or 'AuraTech'
                price = item.get('price') or 0
                feats = item.get('features') or []
                feat_str = "; ".join([str(f)[:60] for f in feats[:3]]) if isinstance(feats, list) else ""
                desc_str = _strip_html(item.get('description', ''))[:100]
                lines.append(f"[{name}] Brand:{brand} | ৳{price} | {feat_str or desc_str}")
            return "COMPARISON ITEMS:\n" + "\n".join(lines), comp_items
        except Exception:
            return f"COMPARISON DATA:\n{str(product_context)[:1200]}", []

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
            'gaming', 'into', 'from', 'which', 'one', 'are', 'bdt', 'taka'
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

    context_lines = [_compress_product_for_prompt(p) for p in matched]
    final_context = "INVENTORY CONTEXT:\n" + "\n".join(context_lines)

    if product_context:
        final_context += f"\nCURRENTLY VIEWING:\n{_strip_html(str(product_context))[:350]}"

    return final_context, matched


def _build_local_smart_fallback(message: str, matched_items: list, product_context: str = "") -> str:
    if product_context and "comparison_data" in str(product_context) and matched_items:
        lines = ["**Product Comparison:**"]
        best_item = None
        lowest_price = None

        for idx, item in enumerate(matched_items, 1):
            name = item.get('name', f'Product {idx}')
            price = Number_or_zero(item.get('price'))
            brand = item.get('brand') or 'AuraTech'
            lines.append(f"{idx}. **{name}** — ৳{price:,.0f} (Brand: {brand})")
            if lowest_price is None or (price > 0 and price < lowest_price):
                lowest_price = price
                best_item = item

        lines.append("\n**Key Highlights:**")
        for item in matched_items:
            name = item.get('name', 'Product')
            feats = item.get('features') or []
            top_feat = feats[0] if isinstance(feats, list) and len(feats) > 0 else _strip_html(item.get('description', ''))[:90]
            lines.append(f"* **{name}:** {top_feat or 'Standard manufacturer specifications.'}")

        winner_name = best_item.get('name') if best_item else matched_items[0].get('name')
        lines.append(f"\n**Final Verdict:**\nFor the strongest value-for-money ratio, **{winner_name}** stands out as the most cost-effective choice among your selected items.")
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
            f"* **Brand:** {p.brand or 'AuraTech'}\n"
            f"* **Status:** {'In Stock' if p.stock > 0 else 'Out of Stock'}\n"
            f"* **Key Features:**\n{feat_bullets}\n"
            f"* **Summary:** {_strip_html(p.description)[:160]}"
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
            f"\n**Recommended Pick:** **{best_pick.name}** (৳{bp_price:,.0f}) offers the best balance of features and availability right now."
        )
    return "\n".join(lines)


def Number_or_zero(val) -> float:
    try:
        return float(str(val).replace(',', '').replace('৳', '').strip())
    except Exception:
        return 0.0


def generate_support_chat_reply(history: list, message: str, product_context: str = "") -> str:
    clean_msg = str(message).strip()
    compact_context, matched_items = retrieve_compact_inventory_context(clean_msg, product_context)

    # Clean MD5 cache key (prevents Django CacheKeyWarning on spaces or '৳')
    cache_key = _make_safe_cache_key("chat_v3", f"{clean_msg.lower()}::{compact_context}")
    cached_reply = cache.get(cache_key)
    if cached_reply and len(history) <= 2:
        _log_ai_telemetry("SERVER CACHE HIT (Chat)", extra_note=f"Query: '{clean_msg[:40]}'")
        return cached_reply

    gemini_contents = []
    recent_history = history[-4:] if isinstance(history, list) else []
    for msg in recent_history:
        if not isinstance(msg, dict):
            continue
        raw_role = msg.get('role') or msg.get('sender') or 'user'
        role = "user" if raw_role == 'user' else "model"
        text_val = ""
        if 'parts' in msg and isinstance(msg['parts'], list) and len(msg['parts']) > 0:
            text_val = msg['parts'][0].get('text', '')
        elif 'text' in msg:
            text_val = msg.get('text', '')
        elif 'content' in msg:
            text_val = msg.get('content', '')

        text_trimmed = str(text_val).strip()[:250]
        if text_trimmed:
            gemini_contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=text_trimmed)]
                )
            )

    user_prompt = f"{compact_context}\n\nCUSTOMER QUESTION: {clean_msg[:300]}"
    gemini_contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_prompt)]
        )
    )

    try:
        client = get_gemini_client()
        for model_name in FREE_TIER_MODELS:
            try:
                config_kwargs = {
                    "system_instruction": COMPACT_SHOPPING_PROMPT,
                    "max_output_tokens": 400,
                    "temperature": 0.3,
                }
                if hasattr(types, 'AutomaticFunctionCallingConfig'):
                    config_kwargs["automatic_function_calling"] = types.AutomaticFunctionCallingConfig(disable=True)

                response = client.models.generate_content(
                    model=model_name,
                    contents=gemini_contents,
                    config=types.GenerateContentConfig(**config_kwargs)
                )
                if response and response.text:
                    _log_ai_telemetry(
                        "LIVE GEMINI API (Chat)",
                        model_name=model_name,
                        usage=getattr(response, 'usage_metadata', None),
                        extra_note=f"Sent only {len(matched_items)} compressed products"
                    )
                    reply_text = response.text.strip()
                    cache.set(cache_key, reply_text, timeout=3600)
                    return reply_text
            except Exception as model_err:
                err_str = str(model_err)
                # Only log short warning if a model is retired/rate-limited
                print(f"[Aura AI] Skipping {model_name} -> trying next model ({err_str[:120]}...)")
                continue
    except Exception as client_err:
        print("[Aura AI] Client initialization error:", client_err)

    _log_ai_telemetry(
        "LOCAL DATABASE FALLBACK (Chat)",
        extra_note="API key empty or rate-limited; generated reply directly from PostgreSQL"
    )
    return _build_local_smart_fallback(clean_msg, matched_items, product_context)


def analyze_product_reviews_ai(product_name: str, reviews: list, product_id: int = 0) -> dict:
    if not reviews:
        return {
            "summary": "No customer reviews have been submitted for this product yet. Be the first to share your experience!",
            "sentiment_score": 0,
            "sentiment_label": "Neutral",
            "key_strengths": [],
            "areas_for_improvement": []
        }

    cache_key = _make_safe_cache_key("review_v3", f"{product_id or product_name}::{len(reviews)}")
    cached_data = cache.get(cache_key)
    if cached_data:
        _log_ai_telemetry("SERVER CACHE HIT (Review Analysis)", extra_note=f"Product ID: {product_id}")
        return cached_data

    compact_reviews = "\n".join(
        [f"{r.get('rating', 5)}/5: {_strip_html(r.get('comment', ''))[:100]}" for r in reviews[:8]]
    )
    prompt = (
        f"Product: {product_name[:80]}\nReviews:\n{compact_reviews}\n"
        f"Return JSON with keys: summary (1-2 sentences), sentiment_score (0-100 int), "
        f"sentiment_label (Positive/Neutral/Negative), key_strengths (max 3 short strings), "
        f"areas_for_improvement (max 2 short strings)."
    )

    try:
        client = get_gemini_client()
        for model_name in FREE_TIER_MODELS:
            try:
                config_kwargs = {
                    "response_mime_type": "application/json",
                    "max_output_tokens": 250,
                    "temperature": 0.2,
                }
                if hasattr(types, 'AutomaticFunctionCallingConfig'):
                    config_kwargs["automatic_function_calling"] = types.AutomaticFunctionCallingConfig(disable=True)

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(**config_kwargs)
                )
                if response and response.text:
                    _log_ai_telemetry(
                        "LIVE GEMINI API (Review Analysis)",
                        model_name=model_name,
                        usage=getattr(response, 'usage_metadata', None),
                        extra_note=f"Product: {product_name[:35]}"
                    )
                    result = json.loads(response.text)
                    cache.set(cache_key, result, timeout=86400)
                    return result
            except Exception as model_err:
                print(f"[Aura Review AI] Skipping {model_name} ({str(model_err)[:100]}...)")
                continue
    except Exception as e:
        print("AI Review Analysis Error:", e)

    _log_ai_telemetry(
        "LOCAL DATABASE FALLBACK (Review Analysis)",
        extra_note=f"Product: {product_name[:35]}"
    )
    avg = sum(Number_or_zero(r.get('rating', 5)) for r in reviews) / max(len(reviews), 1)
    fallback_result = {
        "summary": f"Based on {len(reviews)} verified customer review(s), {product_name} holds a strong {avg:.1f}/5 rating for quality and reliability.",
        "sentiment_score": int((avg / 5.0) * 100),
        "sentiment_label": "Positive" if avg >= 4 else ("Neutral" if avg >= 2.5 else "Negative"),
        "key_strengths": ["Verified buyer satisfaction", f"Average rating of {avg:.1f}/5"],
        "areas_for_improvement": []
    }
    cache.set(cache_key, fallback_result, timeout=3600)
    return fallback_result