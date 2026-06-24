import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

UPLOAD_ROOT = Path(settings.UPLOAD_DIR).resolve()
AVATAR_UPLOAD_DIR = UPLOAD_ROOT / "avatars"
EVENT_IMAGE_UPLOAD_DIR = UPLOAD_ROOT / "events"
POST_UPLOAD_DIR = UPLOAD_ROOT / "posts"
REPORT_UPLOAD_DIR = UPLOAD_ROOT / "reports"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic", ".heif"}
GENERIC_CONTENT_TYPES = {"application/octet-stream", "binary/octet-stream"}


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _image_extension(filename: str | None) -> str:
    return Path(filename).suffix.lower() if filename else ""


def _sniff_image(header: bytes) -> bool:
    if header.startswith(b"\x89PNG") or header.startswith(b"\xff\xd8\xff"):
        return True
    if header.startswith(b"GIF8"):
        return True
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return True
    return False


def is_image_upload(file: UploadFile) -> bool:
    content_type = (file.content_type or "").lower()
    if content_type.startswith("image/"):
        return True

    extension = _image_extension(file.filename)
    if extension in IMAGE_EXTENSIONS:
        return True

    if content_type in GENERIC_CONTENT_TYPES or not content_type:
        pos = file.file.tell()
        header = file.file.read(16)
        file.file.seek(pos)
        if _sniff_image(header):
            return True

    return False


def validate_image(file: UploadFile, max_mb: int = 5) -> None:
    if not is_image_upload(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл {file.filename or 'unknown'} не является изображением",
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > max_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл {file.filename or 'unknown'} слишком большой (максимум {max_mb}MB)",
        )


def save_image(file: UploadFile, dest_dir: Path) -> tuple[str, str, int, str]:
    """Сохраняет изображение и возвращает (original_filename, file_path, size, content_type)."""
    ensure_dir(dest_dir)
    file_extension = _image_extension(file.filename) or ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    file_path = (dest_dir / unique_filename).resolve()

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size
    content_type = file.content_type if (file.content_type or "").startswith("image/") else "image/jpeg"
    return file.filename or "unknown", str(file_path), file_size, content_type


def resolve_upload_path(path: str) -> Path:
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = (UPLOAD_ROOT.parent / file_path).resolve()
    return file_path


def delete_file(path: str | None) -> None:
    if not path:
        return
    file_path = resolve_upload_path(path)
    if file_path.is_file():
        file_path.unlink()


def versioned_upload_url(base_path: str, file_path: str) -> str:
    """URL загруженного файла с токеном версии — браузер не показывает старый кэш после замены."""
    token = Path(file_path).stem
    return f"{base_path}?v={token}"
