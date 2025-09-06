import boto3
import logging
import uuid
from typing import Optional
from botocore.exceptions import ClientError, NoCredentialsError
from app.core.config import settings

logger = logging.getLogger(__name__)


class S3Client:
    def __init__(self):
        self.s3_client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize S3 client with credentials"""
        try:
            if settings.aws_access_key_id and settings.aws_secret_access_key:
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.aws_access_key_id,
                    aws_secret_access_key=settings.aws_secret_access_key,
                    region_name=settings.aws_region
                )
            else:
                # Use default credentials (IAM role, environment variables, etc.)
                self.s3_client = boto3.client('s3', region_name=settings.aws_region)
            logger.info("S3 client initialized successfully")
        except NoCredentialsError:
            logger.error("AWS credentials not found")
            raise Exception("AWS credentials not configured")
        except Exception as e:
            logger.error("Failed to initialize S3 client: {}".format(str(e)))
            raise Exception("Failed to initialize S3 client: {}".format(str(e)))
    
    def download_image(self, key: str) -> Optional[str]:
        """Download image from S3 and return local file path"""
        try:
            # Create a temporary file path
            import tempfile
            import os
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            temp_path = temp_file.name
            temp_file.close()
            
            # Download from S3
            self.s3_client.download_file(settings.s3_bucket_name, key, temp_path)
            logger.info("Downloaded image from S3: {}".format(key))
            return temp_path
            
        except ClientError as e:
            logger.error("Failed to download image from S3: {}".format(str(e)))
            return None
        except Exception as e:
            logger.error("Unexpected error downloading image: {}".format(str(e)))
            return None
    
    def upload_image(self, local_file_path: str, s3_key: str) -> Optional[str]:
        """Upload image to S3 and return S3 URI"""
        try:
            # Upload to S3
            self.s3_client.upload_file(local_file_path, settings.s3_bucket_name, s3_key)
            
            # Generate S3 URI
            s3_uri = "s3://{}/{}".format(settings.s3_bucket_name, s3_key)
            logger.info("Uploaded image to S3: {}".format(s3_uri))
            return s3_uri
            
        except ClientError as e:
            logger.error("Failed to upload image to S3: {}".format(str(e)))
            return None
        except Exception as e:
            logger.error("Unexpected error uploading image: {}".format(str(e)))
            return None
    
    def get_avatar_key(self, user_id: str) -> str:
        """Generate S3 key for user avatar"""
        return "{}{}.png".format(settings.s3_avatar_prefix, user_id)
    
    def get_subject_key(self, user_id: str) -> str:
        """Generate S3 key for user subject image"""
        return "{}{}.png".format(settings.s3_subject_prefix, user_id)
    
    def get_generated_key(self, user_id: str, illustration_type: str) -> str:
        """Generate S3 key for generated illustration"""
        unique_id = str(uuid.uuid4())[:8]
        return "{}{}/{}_{}.png".format(
            settings.s3_generated_prefix, 
            user_id, 
            illustration_type, 
            unique_id
        )


# Global S3 client instance
s3_client = S3Client()
