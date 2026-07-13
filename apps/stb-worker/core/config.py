import os
from dotenv import load_dotenv

load_dotenv() # Load variables from .env file

class Settings:
    NODE_ENV = os.getenv('NODE_ENV', 'dev')
    WORKER_SECRET = os.getenv('WORKER_SECRET')
    S3_ENDPOINT = os.getenv('S3_ENDPOINT', 'http://127.0.0.1:9000')
    S3_ACCESS_KEY = os.getenv('S3_ACCESS_KEY')
    S3_SECRET_KEY = os.getenv('S3_SECRET_KEY')
    S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
    WORKER_TMP_DIR = os.getenv('WORKER_TMP_DIR')
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    CF_EMBEDDING_MODEL = '@cf/qwen/qwen3-embedding-0.6b'
    CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
    CLOUDFLARE_AUTH_TOKEN = os.getenv('CLOUDFLARE_AUTH_TOKEN')
    
    UPSTASH_VECTOR_REST_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
    UPSTASH_VECTOR_REST_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')
    
    UPSTASH_REDIS_REST_URL = os.getenv('UPSTASH_REDIS_REST_URL')
    UPSTASH_REDIS_REST_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN')
    
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

settings = Settings()
