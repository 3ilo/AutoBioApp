from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verify the authorization token.
    
    Args:
        credentials: HTTP Bearer token credentials
        
    Returns:
        bool: True if token is valid
        
    Raises:
        HTTPException: If authentication fails
    """
    # Skip authentication if disabled
    if not settings.auth_enabled:
        return True
    
    # Check if token is configured
    if not settings.auth_token:
        logger.warning("Authentication is enabled but no token is configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not properly configured"
        )
    
    # Check if credentials are provided
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token
    if credentials.credentials != settings.auth_token:
        logger.warning(f"Invalid token attempt from client")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.debug("Token verification successful")
    return True

def get_auth_dependency():
    """
    Get authentication dependency based on configuration.
    
    Returns:
        Dependency function or None
    """
    if settings.auth_enabled:
        return Depends(verify_token)
    return None
