import boto3
from botocore.client import Config
from core.config import settings

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )

def download_pdf(tenant_id: str, document_id: str, dest_path: str):
    s3 = get_s3_client()
    object_key = f"{tenant_id}/{document_id}.pdf"
    print(f"[Storage] Downloading {object_key} to {dest_path}")
    s3.download_file(settings.S3_BUCKET_NAME, object_key, dest_path)
