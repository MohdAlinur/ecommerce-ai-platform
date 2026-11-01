# E-Commerce AI Platform

A full-stack storefront and store-management application for AuraTech Bangladesh. The project pairs a React and TypeScript frontend with a Django REST API and includes catalog browsing, customer accounts, ordering, discounts, AI-assisted shopping, and admin tools.

## Features

- Browse and search products, filter by category, and view product details, variants, images, stock, and reviews.
- Use a shopping cart, wishlist, and product comparison; create orders with shipping details, discount codes, and the available payment-method options (cash on delivery, bKash, Nagad, or card).
- Create an account, sign in, manage a customer profile, and review or cancel orders.
- Ask the AI shopping assistant questions using product and store context; request AI analysis of product reviews.
- Manage catalog items, categories, users, discounts, and orders from the admin dashboard; import or delete products in bulk and review store analytics.
- Maintain product media and customer avatars in Django's media directory.

Payment options are recorded by the application, but the backend does not integrate a payment gateway. The AI assistant can use configured external model providers; provider access requires API keys.

## Project layout

```text
.
├── backend/
│   ├── api/              # Models, serializers, API views, and migrations
│   ├── core/             # Django settings and URL configuration
│   ├── media/            # Uploaded product images and avatars
│   ├── manage.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/   # Store UI, account/auth, cart, and AI chat
│   │   ├── context/      # Cart, wishlist, and compare state
│   │   └── pages/        # Store, product, customer, auth, and admin views
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Technology

- **Backend:** Python 3.14+, Django 6.1, Django REST Framework, PostgreSQL, and Django session authentication.
- **Frontend:** React 19, TypeScript, Vite 8, React Router, Tailwind CSS, Axios, Recharts, and Lucide.
- **AI:** Gemini and OpenAI-compatible provider integrations, selected through the backend AI service.
- **Package tools:** `uv` for Python projects and npm for the frontend.

## Requirements

- Python 3.14 or newer and [`uv`](https://docs.astral.sh/uv/)
- Node.js and npm (use a version supported by Vite 8)
- PostgreSQL
- API keys for any AI provider you want to enable (optional for non-AI storefront features)

The Django settings use PostgreSQL by default. Create a database named `ecommerce_ai_db` (or configure another name) before starting the backend. The checked-in `backend/db.sqlite3` is not selected by the current settings.

### Backend dependency manifest note

Before setting up a clean Python environment, reconcile `backend/pyproject.toml` with the imports used by the source. It currently does not declare Django REST Framework, `django-cors-headers`, `python-dotenv`, a PostgreSQL driver, or `google-genai`; the AI service imports `google.genai`, which is not provided by the declared `google-generativeai` package. As a result, `uv sync` from the current manifest alone may not produce a runnable backend environment.

## Configuration

Create `backend/.env` and set the database values and a Django secret:

```env
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=ecommerce_ai_db
DB_USER=postgres
DB_PASSWORD=your-postgres-password
DB_HOST=localhost
DB_PORT=5432
```

AI keys are optional. Add one or more keys for the providers you intend to use:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
# GEMINI_API_KEYS=comma-separated-keys
SAMBANOVA_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
GITHUB_MODELS_KEY=
MISTRAL_API_KEY=
CEREBRAS_API_KEY=
```

Do not commit real credentials. The backend loads this file from `backend/.env`.

## Run locally

### 1. Start the backend

After resolving the backend dependency-manifest note above and installing the required packages:

```powershell
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py runserver
```

The API is served at `http://127.0.0.1:8000/`; Django admin is at `http://127.0.0.1:8000/admin/`.

### 2. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The npm `dev` script starts Vite at `http://127.0.0.1:3001/`. The frontend API client currently targets `http://127.0.0.1:8000/api`, and Django CORS/CSRF settings allow the configured local development origins.

## API overview

All application endpoints are under `/api/`.

| Area | Routes |
| --- | --- |
| Catalog | `/categories/`, `/products/`, `/store-highlights/` |
| Reviews | `/reviews/`, `/products/<id>/analyze-ai/` |
| Orders | `/orders/`, `/orders/<id>/cancel/` |
| Discounts and banners | `/discounts/`, `/discounts/validate/`, `/banners/` |
| Authentication and profile | `/auth/signup/`, `/auth/login/`, `/auth/logout/`, `/auth/profile/`, `/auth/google/` |
| AI support | `/chat/support/` |
| Admin | `/admin/users/`, `/admin/users/create-admin/`, `/admin/products/bulk-csv/`, `/admin/products/bulk-delete/`, `/admin/analytics/` |

Catalog reads are public. Creating reviews and orders requires authentication; catalog changes, order administration, bulk operations, and admin endpoints require staff permissions. Authentication uses Django sessions, so API requests include credentials and unsafe requests use the CSRF token.

## Development checks

From `frontend/`, run the production TypeScript check/build and ESLint:

```powershell
npm run build
npm run lint
```

The backend's `api/tests.py` currently contains only Django's test scaffold; add application tests as features evolve.
