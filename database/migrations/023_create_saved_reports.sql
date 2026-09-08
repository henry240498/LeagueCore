-- LeagueCore - Módulo de Reportes: guardar configuraciones de reportes (filtros/columnas/orden) y
-- marcarlas como favoritas (pedido explícito §31/§32/§33). Es la ÚNICA tabla nueva que necesita el
-- módulo -- todo lo demás (partidos, jugadores, equipos, estadísticas, clasificaciones, historial de
-- importación, auditoría) ya existe y los reportes lo consultan directamente, sin duplicar datos.
--
-- filters/columns se guardan como JSON en NVARCHAR(MAX) en vez de columnas normalizadas: cada tipo
-- de reporte tiene un conjunto de filtros distinto (mismo motivo que match_advanced_metrics en la
-- migración 015 -- evita una tabla/columna nueva por cada combinación futura de filtro).

USE LeagueCore;
GO

IF OBJECT_ID('dbo.saved_reports', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.saved_reports (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT             NOT NULL,
        name            NVARCHAR(150)   NOT NULL,
        report_type     NVARCHAR(50)    NOT NULL,
        filters         NVARCHAR(MAX)   NULL,
        columns         NVARCHAR(MAX)   NULL,
        sort_by         NVARCHAR(50)    NULL,
        sort_dir        NVARCHAR(4)     NULL,
        is_favorite     BIT             NOT NULL CONSTRAINT DF_saved_reports_favorite DEFAULT 0,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_saved_reports_created DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2       NULL,
        CONSTRAINT FK_saved_reports_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_saved_reports_user ON dbo.saved_reports(user_id);
END
GO
