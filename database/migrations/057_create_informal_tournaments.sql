-- 057_create_informal_tournaments.sql
-- Torneos informales: torneos casuales/amistosos que se arman rápido, sin la estructura
-- formal de una competición (sin puntos, ascensos/descensos, temporadas ni clubes ligados).
-- Los participantes se guardan como texto libre (uno por línea) para no atarlos al catálogo
-- de equipos; se puede normalizar a una tabla hija más adelante si hace falta.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.informal_tournaments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.informal_tournaments (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(150)  NOT NULL,
    sport         NVARCHAR(50)   NULL,
    format        NVARCHAR(30)   NULL,          -- liga | eliminacion | grupos | amistoso
    status        NVARCHAR(20)   NOT NULL CONSTRAINT DF_informal_tournaments_status DEFAULT 'abierto', -- abierto | en_curso | finalizado
    location      NVARCHAR(150)  NULL,
    start_date    DATE           NULL,
    end_date      DATE           NULL,
    max_teams     INT            NULL,
    organizer     NVARCHAR(150)  NULL,
    contact       NVARCHAR(150)  NULL,
    participants  NVARCHAR(MAX)  NULL,           -- un participante por línea
    observations  NVARCHAR(1000) NULL,
    created_at    DATETIME2      NOT NULL CONSTRAINT DF_informal_tournaments_created DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2      NOT NULL CONSTRAINT DF_informal_tournaments_updated DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_informal_tournaments_status ON dbo.informal_tournaments (status);
  CREATE INDEX IX_informal_tournaments_name   ON dbo.informal_tournaments (name);
END
GO
