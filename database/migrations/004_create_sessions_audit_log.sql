-- LeagueCore - sesiones (para poder revocar/listar) + auditoría de seguridad

USE LeagueCore;
GO

IF OBJECT_ID('dbo.sessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sessions (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        user_id     INT             NOT NULL,
        token_hash  NVARCHAR(128)   NOT NULL,
        expires_at  DATETIME2       NOT NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_sessions_created_at DEFAULT SYSUTCDATETIME(),
        revoked_at  DATETIME2       NULL,
        ip_address  NVARCHAR(64)    NULL,
        user_agent  NVARCHAR(300)   NULL,
        CONSTRAINT FK_sessions_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_sessions_user_id ON dbo.sessions(user_id);
    CREATE UNIQUE INDEX UX_sessions_token_hash ON dbo.sessions(token_hash);
END
GO

IF OBJECT_ID('dbo.audit_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_log (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT             NULL,
        action          NVARCHAR(50)    NOT NULL,
        entity          NVARCHAR(50)    NULL,
        entity_id       INT             NULL,
        details         NVARCHAR(1000)  NULL,
        ip_address      NVARCHAR(64)    NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_audit_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_audit_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_audit_user_id ON dbo.audit_log(user_id);
    CREATE INDEX IX_audit_created_at ON dbo.audit_log(created_at);
END
GO
