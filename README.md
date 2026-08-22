# 🛍️ E-Commerce AI Platform

A modern, full-stack e-commerce application featuring a robust **Django REST Framework (DRF)** backend managed by Astral's `uv` package runner, and a high-performance **React + Vite + TypeScript** frontend.

---

## 🏗️ Project Architecture

This project is structured as a monorepo containing:
- **`backend/`**: Django REST API handling authentication, products, categories, reviews, orders, and AI integration services.
- **`frontend/`**: React SPA built with Vite, Tailwind CSS, and TypeScript for the user and admin dashboards.

---

## 🛠️ Tech Stack

### Backend
* **Python** (Managed via `uv`)
* **Django & Django REST Framework (DRF)**
* **Database**: SQLite (Development)

### Frontend
* **React** with **TypeScript**
* **Vite** (Bundler)
* **Tailwind CSS** (Styling)

---

## 🚀 Getting Started Locally

### Prerequisites
Make sure you have the following installed on your machine:
* [Python](https://www.python.org/) (v3.10+)
* [Node.js](https://nodejs.org/) & npm
* [Astral `uv`](https://github.com/astral-sh/uv) (`pip install uv`)

---

### 1. Backend Setup (`backend/`)

Navigate to the backend directory and set up your environment using `uv`:

```bash
cd backend

# Sync dependencies using uv
uv sync

# Run database migrations
uv run manage.py migrate

# Create a superuser for admin access
uv run manage.py createsuperuser

# Start the development server
uv run manage.py runserver
