import os
import json
from google import genai
from google.genai import types

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)

def analyze_product_reviews_ai(product_name: str, reviews: list) -> dict:
    client = get_gemini_client()
    if not reviews:
        return {
            "summary": "No reviews have been submitted for this product yet.",
            "sentiment_score": 0,
            "sentiment_label": "Neutral",
            "key_strengths": [],
            "areas_for_improvement": []
        }

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

def chat_customer_support_ai(history: list, user_message: str, product_context: str) -> str:
    client = get_gemini_client()
    
    system_prompt = f"""
    You are an intelligent, empathetic customer support assistant for our E-commerce store.
    
    Context about the product(s) the user is currently viewing or asking about:
    {product_context}

    Guidelines:
    1. If the context contains deep specifications or features for a specific product, use them to answer highly specific technical questions (e.g., ports, resolution, performance).
    2. Help users discover products, check specs, understand return policies (30-day money back), and clarify order statuses.
    3. Be polite, concise, and helpful.
    """

    formatted_contents = []
    for msg in history:
        role = "user" if msg.get("sender") == "user" else "model"
        formatted_contents.append(f"{role.capitalize()}: {msg.get('text')}")
    formatted_contents.append(f"User: {user_message}")

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents="\n".join(formatted_contents),
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7
        )
    )
    return response.text