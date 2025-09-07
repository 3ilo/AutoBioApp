import boto3
import logging
import uuid
import tempfile
import os
import time
import io
from typing import Optional
from botocore.exceptions import ClientError, NoCredentialsError
from app.core.config import settings

logger = logging.getLogger(__name__)


class S3Client:
    def __init__(self):
        self.s3_client = None
        self._last_progress_time = 0
        self._progress_interval = 10  # Log every 5 seconds
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
    
    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes == 0:
            return "0B"
        size_names = ["B", "KB", "MB", "GB", "TB"]
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_names[i]}"
    
    def _progress_callback(self, bytes_transferred: int, total_size: int):
        """Progress callback for S3 download - logs every 5 seconds"""
        current_time = time.time()
        
        # Only log if 5 seconds have passed since last log
        if current_time - self._last_progress_time >= self._progress_interval:
            if total_size > 0:
                percentage = (bytes_transferred / total_size) * 100
                transferred_str = self._format_size(bytes_transferred)
                total_str = self._format_size(total_size)
                logger.info(f"Download progress: {percentage:.1f}% ({transferred_str}/{total_str})")
            
            self._last_progress_time = current_time
    
    def download_model_from_s3(self, s3_path: str) -> Optional[str]:
        """Download model from S3 and return local file path"""
        try:
            # Reset progress timer for new download
            self._last_progress_time = 0
            
            # Parse S3 path
            if not s3_path.startswith('s3://'):
                raise ValueError("S3 path must start with 's3://'")
            
            # Extract bucket and key
            s3_path = s3_path[5:]  # Remove 's3://'
            bucket, key = s3_path.split('/', 1)
            
            # Create local temp file
            local_path = os.path.join(tempfile.gettempdir(), f"model_{os.path.basename(key)}")
            
            # Check if file already exists locally
            if os.path.exists(local_path):
                file_size = os.path.getsize(local_path)
                size_str = self._format_size(file_size)
                logger.info(f"Model already exists locally: {local_path} ({size_str})")
                return local_path
            
            # Get file size from S3
            logger.info(f"Checking model size in S3: {s3_path}")
            response = self.s3_client.head_object(Bucket=bucket, Key=key)
            file_size = response['ContentLength']
            size_str = self._format_size(file_size)
            logger.info(f"Model size: {size_str}")
            
            # Download from S3 with progress
            logger.info(f"Starting download from S3: {s3_path}")
            self.s3_client.download_file(
                bucket, 
                key, 
                local_path,
                Callback=lambda bytes_transferred: self._progress_callback(bytes_transferred, file_size)
            )
            
            # Verify download
            downloaded_size = os.path.getsize(local_path)
            downloaded_str = self._format_size(downloaded_size)
            logger.info(f"✅ Successfully downloaded model: {s3_path} -> {local_path}")
            logger.info(f"Downloaded size: {downloaded_str}")
            
            return local_path
            
        except ClientError as e:
            logger.error(f"Failed to download model from S3: {e}")
            return None
        except Exception as e:
            logger.error(f"Error downloading model: {e}")
            return None
    
    def upload_image_from_memory(self, image, s3_key: str) -> Optional[str]:
        """Upload PIL image to S3 using temporary file"""
        temp_file = None
        try:
            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            temp_path = temp_file.name
            temp_file.close()
            
            # Save PIL image to temporary file
            image.save(temp_path, format='PNG')
            
            # Upload file to S3
            self.s3_client.upload_file(temp_path, settings.s3_bucket_name, s3_key)
            
            # Generate S3 URI
            s3_uri = "s3://{}/{}".format(settings.s3_bucket_name, s3_key)
            logger.info("Uploaded image to S3: {}".format(s3_uri))
            
            return s3_uri
            
        except Exception as e:
            logger.error("Failed to upload image to S3: {}".format(str(e)))
            return None
        finally:
            # Clean up temporary file
            if temp_file and os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def download_image(self, key: str) -> Optional[str]:
        """Download image from S3 and return local file path"""
        try:
            # Create a temporary file path
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