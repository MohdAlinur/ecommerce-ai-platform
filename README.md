# E-Commerce AI Platform

AuraTech Bangladesh is a full-stack e-commerce storefront and store-management application. The repository contains a React/TypeScript frontend and a Django REST API backed by PostgreSQL.

## What the application includes

- Product catalog with categories, search, product detail pages, variants, stock, images, reviews, and store highlights.
- Shopping cart, wishlist, product comparison, discount-code validation, and order creation.
- Customer registration, sign-in, profile management, order history, and order cancellation.
- Staff tools for products, categories, users, discounts, orders, support guides, bulk product import/deletion, and analytics.
- AI customer support and product-review analysis, when an AI provider API key is configured.
- Product and avatar uploads served from Django's media directory during local development.

**Payments are not processed by a payment gateway.** The checkout records a selected payment method and related order details; it does not charge cards or verify bKash/Nagad transactions. AI provider access requires an API key and may be subject to the provider's costs and rate limits.

## Repository layout

```text
.
├── backend/
│   ├── api/                 # API, models, serializers, and migrations
│   ├── core/                # Django settings and URL configuration
│   ├── media/               # Uploaded images
│   ├── manage.py
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/                 # React app, components, pages, and API client
│   ├── package.json
│   └── package-lock.json
└── README.md
```

## Technology

- **Backend:** Python 3.14+, Django 6.1, Django REST Framework, PostgreSQL, and session-based authentication.
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS, Axios, React Router, Recharts, and Lucide.
- **AI:** Gemini plus OpenAI-compatible provider integrations (SambaNova, Groq, OpenRouter, GitHub Models, and Mistral).
- **Python dependency manager:** [`uv`](https://docs.astral.sh/uv/)
- **JavaScript dependency manager:** npm

## Prerequisites

The instructions below use **Windows PowerShell** and assume commands are run from the repository root.

1. **Git** — required to clone the repository.
2. **Python 3.14 or newer** — install from [python.org](https://www.python.org/downloads/windows/). During installation, enable the option to add Python to `PATH`, or use the Python launcher (`py`).
3. **uv** — install using the [official uv instructions](https://docs.astral.sh/uv/getting-started/installation/). For example, in PowerShell:

   ```powershell
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

4. **Node.js 22.12+ (LTS recommended)** — install from [nodejs.org](https://nodejs.org/); npm is included with Node.js. Vite 8 requires a recent Node.js release.
5. **PostgreSQL** — install a supported PostgreSQL release using the [official Windows installer](https://www.postgresql.org/download/windows/), or use an existing PostgreSQL server. The backend connects to `localhost:5432` by default.
6. **Optional AI provider key** — needed only for AI assistant and AI review-analysis features.

Open a new PowerShell window after installing tools, then confirm they are available:

```powershell
py --version
uv --version
node --version
npm --version
psql --version
```

If `psql` is not on `PATH`, use the SQL Shell (psql) or pgAdmin installed with PostgreSQL instead.

## Installation and first run

### 1. Get the code

If you have not already cloned the repository:

```powershell
git clone https://github.com/MohdAlinur/ecommerce-ai-platform.git
Set-Location .\ecommerce-ai-platform
```

If the repository is already open in VS Code, open a terminal at its root instead.

### 2. Create the PostgreSQL database and login

Start the PostgreSQL service if it is not already running. Connect as the PostgreSQL administrator; enter the password you chose during PostgreSQL installation when prompted:

```powershell
psql -U postgres -h localhost -p 5432
```

At the `postgres=#` prompt, create a dedicated local application role and database. Replace the example password with a strong local password and remember it for the backend configuration:

```sql
CREATE ROLE ecommerce_ai_user WITH LOGIN PASSWORD 'replace-with-a-local-password';
CREATE DATABASE ecommerce_ai_db OWNER ecommerce_ai_user;
\q
```

If you prefer pgAdmin, run the two SQL statements in its Query Tool as a PostgreSQL administrator. Do not include `\q` in the Query Tool.

### 3. Configure the backend

Create `backend/.env` (for example, run `notepad .\backend\.env` from the repository root) and add:

```dotenv
DJANGO_SECRET_KEY=replace-with-a-random-secret
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=ecommerce_ai_db
DB_USER=ecommerce_ai_user
DB_PASSWORD=replace-with-the-local-password-from-the-role-command
DB_HOST=localhost
DB_PORT=5432

# AI keys are optional; add only the provider keys you use.
GEMINI_API_KEY=
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
# GEMINI_API_KEYS=comma-separated-Gemini-keys
SAMBANOVA_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
GITHUB_MODELS_KEY=
MISTRAL_API_KEY=
```

Generate a Django secret after the backend dependencies are installed (next step) with:

```powershell
Set-Location .\backend
uv run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
Set-Location ..
```

Copy the printed value into `DJANGO_SECRET_KEY`. The backend reads configuration from `backend/.env`; this file is ignored by Git. Never commit real secrets. AI variables can be left blank for ordinary storefront use; AI endpoints may not work until a supported provider is configured.

### 4. Install backend dependencies and initialize the database

From the repository root:

```powershell
Set-Location .\backend
uv python install 3.14
uv sync --locked
uv run python manage.py check
uv run python manage.py migrate
uv run python manage.py createsuperuser
```

`uv sync --locked` installs the dependencies recorded in `backend/uv.lock` and creates a project virtual environment. `createsuperuser` prompts for the administrator username, email, and password; use these credentials to sign in to Django Admin and the staff-only areas.

If you need to use another supported Python 3.14+ interpreter, install/select it with uv before syncing. For normal application startup, continue using `uv run` so commands use the project's managed environment.

### 5. Install frontend dependencies

Open a **second** PowerShell terminal at the repository root:

```powershell
Set-Location .\frontend
npm ci
```

`npm ci` installs the exact dependency versions from `frontend/package-lock.json`. Use `npm install` only when intentionally changing frontend dependencies and the lockfile.

### 6. Start both development servers

In the first terminal (backend):

```powershell
Set-Location .\backend
uv run python manage.py runserver
```

In the second terminal (frontend):

```powershell
Set-Location .\frontend
npm run dev
```

Open **http://127.0.0.1:3001/**. The backend API is at **http://127.0.0.1:8000/api/** and Django Admin is at **http://127.0.0.1:8000/admin/**.

The Vite npm script explicitly uses port `3001`, even though the Vite config also contains a default port. The frontend API client is currently configured with the fixed backend URL `http://127.0.0.1:8000/api`; changing the backend host/port also requires updating the frontend API configuration. Django's local CORS and CSRF allowlists include the standard local development origins.

After startup, sign in with the superuser created above to manage the store. A newly initialized database may not contain products; add categories and products through the admin tools before expecting the storefront to show a populated catalog.

## Configuration reference

| Variable                                                                                          | Purpose                           | Default / notes                                                                                                |
| ------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DJANGO_SECRET_KEY`                                                                               | Django signing and session secret | Set a unique random value. The source has a development fallback; do not rely on it outside local development. |
| `DEBUG`                                                                                           | Enables Django debug behavior     | Defaults to `True`; set to `False` for a properly configured deployment.                                       |
| `ALLOWED_HOSTS`                                                                                   | Comma-separated Django hostnames  | Defaults to `*`; set explicit hostnames for any shared or deployed environment.                                |
| `DB_NAME`                                                                                         | PostgreSQL database               | Defaults to `ecommerce_ai_db`.                                                                                 |
| `DB_USER` / `DB_PASSWORD`                                                                         | PostgreSQL login                  | Defaults to `postgres` / `postgres`; use a dedicated role instead.                                             |
| `DB_HOST` / `DB_PORT`                                                                             | PostgreSQL address                | Defaults to `localhost` / `5432`.                                                                              |
| `GEMINI_API_KEY`, `_2`, `_3`                                                                      | Gemini credentials                | AI features are optional. `GEMINI_API_KEYS` can also contain comma-separated Gemini keys.                      |
| `SAMBANOVA_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GITHUB_MODELS_KEY`, `MISTRAL_API_KEY` | Optional AI provider credentials  | Configure only providers for which you have access.                                                            |

The checked-in `backend/db.sqlite3` is not used by the current settings; PostgreSQL is the configured database. The application does not currently read a frontend `.env` setting for its API URL.

## API overview

Application routes are rooted at `/api/`:

| Area                          | Routes                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Catalog                       | `/categories/`, `/products/`, `/store-highlights/`                                                                              |
| Reviews                       | `/reviews/`, `/products/<id>/analyze-ai/`                                                                                       |
| Orders                        | `/orders/`, `/orders/<id>/cancel/`                                                                                              |
| Discounts and banners         | `/discounts/`, `/discounts/validate/`, `/banners/`                                                                              |
| Authentication and profile    | `/auth/signup/`, `/auth/login/`, `/auth/logout/`, `/auth/profile/`, `/auth/google/`                                             |
| AI support and support guides | `/chat/support/`, `/support-guides/`                                                                                            |
| Admin                         | `/admin/users/`, `/admin/users/create-admin/`, `/admin/products/bulk-csv/`, `/admin/products/bulk-delete/`, `/admin/analytics/` |

Catalog reads are public. Creating reviews and orders requires authentication; administrative operations require staff permissions. Authentication uses Django sessions. The browser sends credentials, and state-changing requests require a CSRF token.

## Development and maintenance

Run these commands from their respective project folders:

```powershell
# Frontend: TypeScript check, production bundle, and lint
Set-Location .\frontend
npm run build
npm run lint

# Backend: configuration checks and tests
Set-Location ..\backend
uv run python manage.py check
uv run python manage.py test
```

`api/tests.py` currently contains only Django's test scaffold, so the backend test command does not yet cover the application's business behavior.

When modifying backend models, create and review a migration, then apply it locally:

```powershell
Set-Location .\backend
uv run python manage.py makemigrations
uv run python manage.py migrate
```

Do not use `backend/sync_db.py` as a normal setup command. It manually creates tables and fakes migrations for a specific database-sync scenario.

## Troubleshooting

- **`psql` cannot connect / Django reports connection refused:** Check that PostgreSQL is running, the host and port are correct, the database and role were created, and `DB_PASSWORD` matches the role password. Restart the backend after editing `.env`.
- **`password authentication failed`:** Check the `DB_USER` and `DB_PASSWORD` values in `backend/.env`; do not assume the PostgreSQL administrator password is the application's role password.
- **`uv sync --locked` reports that the lockfile needs updating:** Do not silently discard the lock. Review the dependency changes, run `uv lock` from `backend/` if the manifest was intentionally changed, and commit the resulting lockfile update.
- **`uv` or `node` is not recognized:** Reopen the terminal after installation and confirm the tool's install directory is on `PATH`.
- **Frontend cannot reach the API or a CORS/CSRF error appears:** Run both servers at the documented local addresses and ports. The API URL is set in `frontend/src/api.ts`; allowed origins are configured in `backend/core/settings.py`.
- **The store appears empty:** The initial database migration does not populate a product catalog. Sign in as staff and add categories and products.
- **AI replies are unavailable:** Configure at least one supported provider API key in `backend/.env`, restart Django, and check the provider account's access and rate limits.
- **Port already in use:** Stop the other process using the port or deliberately change the corresponding server command/configuration and update the frontend API URL, CORS origins, and CSRF trusted origins consistently.

## Deployment notes

The Django development server and Vite development server are for local development, not production hosting. Production deployment requires a production-grade Django application server and frontend build/hosting, HTTPS, explicit `ALLOWED_HOSTS`, a strong private `DJANGO_SECRET_KEY`, `DEBUG=False`, secure cookie/proxy settings, configured static and uploaded-media storage, database backups, and appropriately restricted database credentials. Those deployment settings and an actual payment-gateway integration are not included in this repository.
