import os
import django
from django.db import connection
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.ai_services import ensure_default_support_kb

SQL_STATEMENTS = [
    # 1. Create SupportKnowledgeBase table for 0-token Customer Service Guides
    """
    CREATE TABLE IF NOT EXISTS api_supportknowledgebase (
        id BIGSERIAL PRIMARY KEY,
        topic_slug VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(200) NOT NULL,
        keywords TEXT NOT NULL,
        response_markdown TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        hit_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    # 2. Create AIChatCacheEntry table for persistent 0-token AI answer caching
    """
    CREATE TABLE IF NOT EXISTS api_aichatcacheentry (
        id BIGSERIAL PRIMARY KEY,
        cache_key VARCHAR(64) NOT NULL UNIQUE,
        question VARCHAR(500) NOT NULL,
        reply_markdown TEXT NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
]

def main():
    print("1. Creating SupportKnowledgeBase & AIChatCacheEntry tables in PostgreSQL...")
    with connection.cursor() as cursor:
        for sql in SQL_STATEMENTS:
            cursor.execute(sql)

    print("2. Syncing Django migrations...")
    call_command('makemigrations', 'api')
    call_command('migrate', 'api', fake=True)
    call_command('migrate')

    print("3. Seeding default step-by-step Customer Service guides into PostgreSQL...")
    ensure_default_support_kb()
    print("SUCCESS! Database tables and Customer Service Knowledge Base are ready!")

if __name__ == '__main__':
    main()