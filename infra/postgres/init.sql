-- Инициализация PostgreSQL: RBAC
-- Создание ограниченного пользователя для приложения
-- Выполняется автоматически при первом запуске контейнера

-- Приложение работает под app_user с минимальными привилегиями
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password';
    END IF;
END
$$;

-- Права на текущую БД
GRANT CONNECT ON DATABASE teamzachet TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Права на существующие таблицы
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Права на будущие таблицы (создаваемые миграциями)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;
