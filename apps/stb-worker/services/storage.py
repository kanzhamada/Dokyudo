import boto3
from botocore.client import Config
from core.config import settings
from core.logger import log_event

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )

def download_document(tenant_id: str, storage_path: str, dest_path: str):
    s3 = get_s3_client()
    object_key = f"{tenant_id}/{storage_path}"
    log_event("storage.download", "Downloading document from S3.", tenant_id=tenant_id, object_key=object_key, dest_path=dest_path)
    s3.download_file(settings.S3_BUCKET_NAME, object_key, dest_path)

def upload_document(local_path: str, tenant_id: str, object_key_name: str, content_type: str = "application/pdf"):
    s3 = get_s3_client()
    object_key = f"{tenant_id}/{object_key_name}"
    log_event("storage.upload", "Uploading file to S3.", tenant_id=tenant_id, object_key=object_key, content_type=content_type)
    s3.upload_file(local_path, settings.S3_BUCKET_NAME, object_key, ExtraArgs={"ContentType": content_type})
