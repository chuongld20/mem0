import logging

from sqlalchemy.ext.asyncio import AsyncSession

from . import service

logger = logging.getLogger(__name__)


async def webhook_retry_sweep(db: AsyncSession) -> int:
    """Called periodically to retry failed webhook deliveries with exponential backoff."""
    retried = await service.retry_failed_deliveries(db)
    if retried > 0:
        logger.info("Webhook retry sweep: %d deliveries retried successfully", retried)
    return retried
