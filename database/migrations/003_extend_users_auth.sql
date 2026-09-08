-- LeagueCore - extiende dbo.users para login real + agrega sessions/audit_log
-- La tabla users se creó vacía en la migración 001 (sin datos reales todavía),
-- así que es seguro ALTER-arla en vez de tener que migrar datos existentes.
--
-- Cambios sobre el modelo de la migración 001:
-- - username: login primario (el pedido explícito es admin/123456, no un email)
-- - email pasa a ser opcional (índice único filtrado: permite múltiples NULL)
-- - password_temp_reset, login_attempts, locked_until, last_login, updated_at: soporte
--   de bloqueo por intentos fallidos y cambio de contraseña forzado en primer login

USE LeagueCore;
GO

IF COL_LENGTH('dbo.users', 'username') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD username NVARCHAR(50) NOT NULL CONSTRAINT DF_users_username DEFAULT '';
END
GO

-- Sin default real posible para UNIQUE, se crea el índice único aparte (tabla vacía, es seguro)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_username')
BEGIN
    ALTER TABLE dbo.users DROP CONSTRAINT DF_users_username;
    CREATE UNIQUE INDEX UX_users_username ON dbo.users(username);
END
GO

-- email pasa a ser opcional; se reemplaza el UNIQUE por un índice único filtrado
IF EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
           WHERE i.object_id = OBJECT_ID('dbo.users') AND c.name = 'email' AND i.is_unique = 1 AND i.type_desc = 'CLUSTERED')
BEGIN
    -- email es parte de la PK/clustered (no debería pasar); no tocar en ese caso
    PRINT 'Aviso: email forma parte de un índice clustered, revisar manualmente.';
END
ELSE
BEGIN
    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE type = 'UQ' AND parent_object_id = OBJECT_ID('dbo.users'))
    BEGIN
        DECLARE @ux_name NVARCHAR(128) = (
            SELECT kc.name FROM sys.key_constraints kc
            JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
            JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE kc.parent_object_id = OBJECT_ID('dbo.users') AND c.name = 'email'
        );
        IF @ux_name IS NOT NULL
            EXEC('ALTER TABLE dbo.users DROP CONSTRAINT ' + @ux_name);
    END
    ALTER TABLE dbo.users ALTER COLUMN email NVARCHAR(256) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_email_filtered')
        CREATE UNIQUE INDEX UX_users_email_filtered ON dbo.users(email) WHERE email IS NOT NULL;
END
GO

IF COL_LENGTH('dbo.users', 'password_temp_reset') IS NULL
    ALTER TABLE dbo.users ADD password_temp_reset BIT NOT NULL CONSTRAINT DF_users_pwd_temp DEFAULT 0;
GO
IF COL_LENGTH('dbo.users', 'updated_at') IS NULL
    ALTER TABLE dbo.users ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_users_updated_at DEFAULT SYSUTCDATETIME();
GO
IF COL_LENGTH('dbo.users', 'last_login') IS NULL
    ALTER TABLE dbo.users ADD last_login DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.users', 'login_attempts') IS NULL
    ALTER TABLE dbo.users ADD login_attempts SMALLINT NOT NULL CONSTRAINT DF_users_login_attempts DEFAULT 0;
GO
IF COL_LENGTH('dbo.users', 'locked_until') IS NULL
    ALTER TABLE dbo.users ADD locked_until DATETIME2 NULL;
GO
