import os
import django
from django.db import connection
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

SQL_STATEMENTS = [
    # 1. Synchronize CustomerProfile columns
    'ALTER TABLE api_customerprofile DROP COLUMN IF EXISTS shipping_address CASCADE;',
    'ALTER TABLE api_customerprofile ADD COLUMN IF NOT EXISTS avatar VARCHAR(100) NULL;',
    'ALTER TABLE api_customerprofile ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) NULL;',
    'ALTER TABLE api_customerprofile ADD COLUMN IF NOT EXISTS default_shipping_address TEXT NULL;',
    "ALTER TABLE api_customerprofile ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL DEFAULT 'Dhaka';",
    'ALTER TABLE api_customerprofile ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NULL;',
    "ALTER TABLE api_customerprofile ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL DEFAULT 'Bangladesh';",

    # 2. Synchronize Product columns
    'ALTER TABLE api_product ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;',
    'ALTER TABLE api_product ADD COLUMN IF NOT EXISTS image VARCHAR(100) NULL;',
    'ALTER TABLE api_product ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL;',
    "ALTER TABLE api_product ADD COLUMN IF NOT EXISTS image_gallery JSONB NOT NULL DEFAULT '[]'::jsonb;",
    "ALTER TABLE api_product ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;",
    "ALTER TABLE api_product ADD COLUMN IF NOT EXISTS key_features JSONB NOT NULL DEFAULT '[]'::jsonb;",
    "ALTER TABLE api_product ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '[]'::jsonb;",

    # 3. Synchronize Review columns
    'ALTER TABLE api_review ADD COLUMN IF NOT EXISTS user_id INTEGER NULL REFERENCES auth_user(id) ON DELETE SET NULL;',
    'ALTER TABLE api_review ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT TRUE;',

    # 4. Synchronize Order columns
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS user_id INTEGER NULL REFERENCES auth_user(id) ON DELETE SET NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS shipping_address TEXT NULL;',
    "ALTER TABLE api_order ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL DEFAULT 'Dhaka';",
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NULL;',
    "ALTER TABLE api_order ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL DEFAULT 'Bangladesh';",
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS order_notes TEXT NULL;',
    "ALTER TABLE api_order ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cod';",
    "ALTER TABLE api_order ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';",
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS card_holder_name VARCHAR(150) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS card_expiry VARCHAR(10) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS payment_phone VARCHAR(25) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS bkash_trx_id VARCHAR(100) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS discount_code VARCHAR(30) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100) NULL;',
    'ALTER TABLE api_order ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();',

    # 5. Synchronize OrderItem columns
    'ALTER TABLE api_orderitem ALTER COLUMN product_id DROP NOT NULL;',
    "ALTER TABLE api_orderitem ADD COLUMN IF NOT EXISTS product_name_snapshot VARCHAR(255) NOT NULL DEFAULT '';",
    "ALTER TABLE api_orderitem ADD COLUMN IF NOT EXISTS selected_variants JSONB NOT NULL DEFAULT '{}'::jsonb;",

    # 6. Ensure Banner & DiscountCode tables exist
    """
    CREATE TABLE IF NOT EXISTS api_banner (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        image VARCHAR(100) NULL,
        image_url VARCHAR(500) NULL,
        link VARCHAR(255) NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS api_discountcode (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        discount_percent INTEGER NOT NULL DEFAULT 10,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        usage_limit INTEGER NULL DEFAULT 100,
        times_used INTEGER NOT NULL DEFAULT 0
    );
    """
]

with connection.cursor() as cursor:
    for sql in SQL_STATEMENTS:
        cursor.execute(sql)

print("PostgreSQL columns synchronized! Marking 0004 migration as applied...")
call_command('migrate', 'api', fake=True)
call_command('migrate')
print("DONE! Now 'uv run python manage.py migrate' will work without any errors.")
