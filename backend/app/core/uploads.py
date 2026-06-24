import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

AVATAR_UPLOAD_DIR = Path("uploads/avatars")
EVENT_IMAGE_UPLOAD_DIR = Path("uploads/events")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def validate_image(file: UploadFile, max_mb: int = 5) -> None:
    if file.content_type and not file.content_type.startswith("image/"):
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
    file_extension = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    file_path = dest_dir / unique_filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size
    content_type = file.content_type or "image/jpeg"
    return file.filename or "unknown", str(file_path), file_size, content_type


def delete_file(path: str | None) -> None:
    if not path:
        return
    file_path = Path(path)
    if file_path.is_file():
        file_path.unlink()
