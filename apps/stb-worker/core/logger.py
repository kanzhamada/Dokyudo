import sys
from core.config import settings

def dev_print(*args, **kwargs):
    """
    Utility function to only print logs when NODE_ENV is set to 'dev'.
    This prevents the console from being flooded in production,
    saving I/O operations on the STB.
    """
    if settings.NODE_ENV == 'dev':
        print(*args, **kwargs)
        sys.stdout.flush()
