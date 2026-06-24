from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, UploadFile, status
from app.models.user import User, Student
from app.models.team import Team, TeamMember
from app.models.post import Post, PostImage
from app.modules.posts.schemas import PostCreateRequest, PostUpdateRequest
from datetime import datetime, timezone
from app.core.uploads import POST_UPLOAD_DIR, ensure_dir, save_image, validate_image, delete_file


async def get_user_team(user: User, db: AsyncSession) -> Optional[Team]:
    """Получает команду пользователя"""
    membership = await db.execute(
        select(TeamMember).where(TeamMember.user_id == user.id)
    )
    membership = membership.scalar_one_or_none()
    if membership:
        return await db.get(Team, membership.team_id)
    return None


async def _load_post_with_relations(post_id: int, db: AsyncSession) -> Post:
    """Вспомогательная функция: загружает пост со всеми отношениями"""
    result = await db.execute(
        select(Post)
        .where(Post.id == post_id)
        .options(
            selectinload(Post.images),
            selectinload(Post.author).selectinload(User.student),
            selectinload(Post.team),
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    return post


async def create_post_logic(
        user: User,
        data: PostCreateRequest,  # <- Имя параметра + тип
        files: List[UploadFile],
        db: AsyncSession
) -> Post:
    """Создание нового поста"""
    ensure_dir(POST_UPLOAD_DIR)
    team = await get_user_team(user, db)

    post = Post(
        title=data.title,
        content=data.content,
        author_id=user.id,
        team_id=team.id if team else None
    )

    db.add(post)
    await db.flush()

    if files:
        for file in files:
            if not file.filename:
                continue
            validate_image(file)
            original_filename, file_path, size, content_type = save_image(file, POST_UPLOAD_DIR)
            post_image = PostImage(
                post_id=post.id,
                filename=original_filename,
                file_path=file_path,
                file_size=size,
                content_type=content_type
            )
            db.add(post_image)

    await db.commit()
    return await _load_post_with_relations(post.id, db)


async def get_post_by_id(post_id: int, db: AsyncSession) -> Post:
    """Получение поста по ID"""
    return await _load_post_with_relations(post_id, db)


async def get_all_posts_logic(
        db: AsyncSession,
        limit: int = 20,
        offset: int = 0
) -> tuple[list, int]:
    """Получение всех постов с пагинацией"""
    total_result = await db.execute(select(func.count(Post.id)))
    total = total_result.scalar()

    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.images),
            selectinload(Post.author).selectinload(User.student),
            selectinload(Post.team),
        )
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    posts = result.scalars().all()
    return posts, total


async def update_post_logic(
        post_id: int,
        user: User,
        data: PostUpdateRequest,  # <- Имя параметра + тип
        db: AsyncSession
) -> Post:
    """Обновление поста (только автор может редактировать)"""
    post = await get_post_by_id(post_id, db)

    if post.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только автор может редактировать пост"
        )

    if data.title is not None:
        post.title = data.title
    if data.content is not None:
        post.content = data.content

    post.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return await _load_post_with_relations(post_id, db)


async def delete_post_logic(
        post_id: int,
        user: User,
        db: AsyncSession
) -> bool:
    """Удаление поста (только автор может удалить)"""
    post = await get_post_by_id(post_id, db)

    if post.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только автор может удалить пост"
        )

    for image in post.images:
        delete_file(image.file_path)

    await db.delete(post)
    await db.commit()
    return True


async def delete_post_image_logic(
        post_id: int,
        image_id: int,
        user: User,
        db: AsyncSession
) -> bool:
    """Удаление изображения из поста"""
    post = await get_post_by_id(post_id, db)

    if post.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только автор может удалять изображения"
        )

    image = next((img for img in post.images if img.id == image_id), None)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Изображение не найдено"
        )

    delete_file(image.file_path)

    await db.delete(image)
    await db.commit()
    return True
