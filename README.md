# 🛍️ E-Commerce AI Platform

A full-stack AI-powered e-commerce platform built with Django REST Framework on the backend and React + TypeScript on the frontend. The app includes product browsing, shopping cart, checkout, customer authentication, AI product analysis, AI customer support, admin management, and sales analytics.

---

## ✨ What This Project Includes

- Product catalog with categories, pricing, stock, reviews, and product media
- Shopping cart and checkout flow with multiple payment methods
- Customer signup/login with profile handling
- AI-powered product review analysis using Gemini
- AI customer support chat integrated with store context
- Admin dashboard for product management, user administration, and analytics
- CSV bulk product import and bulk product deletion
- Promo banners and discount code management
- Responsive storefront and dashboard UI

---

## 🏗️ Project Structure

```text
 ecommerce-ai-platform/
├── backend/
│   ├── api/
│   ├── core/
│   ├── media/
│   ├── manage.py
│   ├── pyproject.toml
│   └── README.md
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── README.md
├── main.py
└── pyproject.toml
```

### Backend

The backend is a Django project under `backend/` and exposes REST APIs for:

- authentication and user profiles
- products and categories
- reviews and orders
- banners and discount codes
- AI content generation and support chat
- admin analytics and management actions

### Frontend

The frontend is a Vite React application under `frontend/` with a storefront, customer dashboard, admin dashboard, cart drawer, AI chat modal, and product detail pages.

---

## 🛠️ Tech Stack

### Backend

- Python
- Django
- Django REST Framework
- PostgreSQL (configured in project settings)
- Google Gemini API for AI features
- Pillow for image handling
- `uv` for Python package management

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Axios
- Recharts
- Lucide React

---

## ✅ Prerequisites

Before starting the project, make sure you have:

- Python 3.10+ (the project currently declares Python 3.14 in its backend config, so a matching version is recommended)
- Node.js and npm
- PostgreSQL running locally
- Astral `uv` installed

Install `uv` if needed:

```bash
pip install uv
```

---

## ⚙️ Environment Setup

Create a `.env` file inside the `backend/` directory with values similar to:

```env
DJANGO_SECRET_KEY=your-secret-key
GEMINI_API_KEY=your-google-gemini-api-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=ecommerce_ai_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
```

If needed, create the database manually:

```bash
createdb ecommerce_ai_db
```

---

## 🚀 Running the Project

### 1) Backend

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py runserver
```

The Django API will run at:

- http://127.0.0.1:8000

### 2) Frontend

Open a new terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend app runs on:

- http://127.0.0.1:3001

---

## 🔐 Authentication and Admin Features

The app includes custom auth endpoints for:

- signup
- login
- logout
- profile retrieval
- Google login route (`/api/auth/google/`)

Admin-only endpoints support:

- listing users
- creating admin users
- deleting users
- bulk CSV product import
- bulk product deletion
- analytics dashboard

---

## 🤖 AI Features

This project uses Google Gemini in the backend for:

- product review sentiment analysis
- AI shopping assistant recommendations
- customer support chat responses

These workflows are handled in:

- `backend/api/ai_services.py`
- `backend/api/views.py`

---

## 📦 API Overview

Main API groups include:

- `/api/categories/`
- `/api/products/`
- `/api/reviews/`
- `/api/orders/`
- `/api/banners/`
- `/api/discounts/`
- `/api/auth/signup/`
- `/api/auth/login/`
- `/api/auth/profile/`
- `/api/chat/support/`
- `/api/admin/analytics/`

---

## 🧪 Notes

- The frontend CORS settings are configured for ports 3000, 3001, and 5173.
- The backend uses Django session authentication and REST API flows for app interactions.
- Product images and media files are stored under `backend/media/`.

---

## 💡 Typical Development Flow

```bash
# Terminal 1
cd backend
uv run python manage.py runserver

# Terminal 2
cd frontend
npm run dev
```

Then open the frontend in the browser and begin using the storefront, cart, and admin dashboards.

---

## 📎 Project Purpose

This project is designed as a modern ecommerce demonstration platform with real shopping flows and AI-enhanced support features, making it suitable for portfolio, demo, or learning purposes
