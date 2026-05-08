from .badge_controller import router as badge_router
from .binder_controller import router as binder_router
from .export_controller import router as export_router
from .health_controller import router as health_router
from .progress_controller import router as progress_router
from .trainer_contact_controller import router as trainer_contact_router

__all__ = [
    "badge_router",
    "binder_router",
    "export_router",
    "health_router",
    "progress_router",
    "trainer_contact_router",
]
