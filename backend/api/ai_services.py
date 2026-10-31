import os
import json
from django.conf import settings
from google import genai
from google.genai import types


def get_gemini_client():
    api_key = getattr(settings, 'GEMINI_API_KEY', None) or os.getenv("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


def analyze_product_reviews_ai(product_name: str, reviews: list) -> dict:
    if not reviews:
        return {
            "summary": "No customer reviews have been submitted for this product yet. Be the first to share your experience!",
            "sentiment_score": 0,
            "sentiment_label": "Neutral",
            "key_strengths": [],
            "areas_for_improvement": []
        }

    try:
        client = get_gemini_client()
        reviews_text = "\n".join([f"- Rating: {r.get('rating')}/5. Comment: {r.get('comment')}" for r in reviews])
        prompt = f"""
        Analyze the customer reviews for the following product: {product_name}
        Customer Reviews:
        {reviews_text}
        Provide a structured JSON output with the exact keys:
        - "summary": (concise paragraph summarizing overall reception)
        - "sentiment_score": (integer 0 to 100)
        - "sentiment_label": ("Positive", "Neutral", or "Negative")
        - "key_strengths": (list of up to 4 top positive bullet points)
        - "areas_for_improvement": (list of up to 4 top constructive criticisms)
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                system_instruction="You are an expert e-commerce data analyst."
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print("AI Review Analysis Error:", e)
        avg = sum(r.get('rating', 5) for r in reviews) / max(len(reviews), 1)
        return {
            "summary": f"Based on {len(reviews)} verified customer review(s), this product holds an average rating of {avg:.1f}/5.",
            "sentiment_score": int((avg / 5.0) * 100),
            "sentiment_label": "Positive" if avg >= 4 else ("Neutral" if avg >= 2.5 else "Negative"),
            "key_strengths": ["Verified customer ratings available"],
            "areas_for_improvement": []
        }