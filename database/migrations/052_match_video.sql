-- LeagueCore - Fase 4: video analysis + etiquetas + sync estadistica-video (puntos 13-15).
--  - match_videos: partido completo / entrenamiento / fragmento / scouting (URL o archivo subido).
--  - video_tags: etiquetas personalizadas (Gol, Presion, Recuperacion...) creadas por el usuario.
--  - video_markers: marcador en un segundo del video, opcionalmente enlazado a un evento real
--    (source + source_id: goal/shots/cards/substitutions/custom) para el salto evento<->video.
--  - video_clips: cortes guardados (inicio/fin/descripcion).
-- Convencion de sync: minuto del evento * 60 + offset_seconds del video.
-- Ejecutar con sqlcmd -f 65001 (UTF-8).

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

-- 1) Videos ----------------------------------------------------------------------
IF OBJECT_ID('dbo.match_videos', 'U') IS NULL
CREATE TABLE dbo.match_videos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    match_id INT NULL CONSTRAINT FK_mv_match FOREIGN KEY REFERENCES dbo.matches(id) ON DELETE CASCADE,
    title NVARCHAR(200) NOT NULL,
    kind NVARCHAR(20) NOT NULL CONSTRAINT DF_mv_kind DEFAULT N'PARTIDO_COMPLETO',
    video_url NVARCHAR(1000) NULL,
    duration_seconds INT NULL,
    offset_seconds INT NOT NULL CONSTRAINT DF_mv_offset DEFAULT 0,
    recorded_at DATE NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_mv_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_mv_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_mv_kind CHECK (kind IN ('PARTIDO_COMPLETO', 'ENTRENAMIENTO', 'FRAGMENTO', 'SCOUTING'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mv_match')
    CREATE INDEX IX_mv_match ON dbo.match_videos(match_id);
GO

-- 2) Etiquetas --------------------------------------------------------------------
IF OBJECT_ID('dbo.video_tags', 'U') IS NULL
CREATE TABLE dbo.video_tags (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL,
    label NVARCHAR(150) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_vt_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_vt_code UNIQUE (code)
);
GO

-- 3) Marcadores --------------------------------------------------------------------
IF OBJECT_ID('dbo.video_markers', 'U') IS NULL
CREATE TABLE dbo.video_markers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    video_id INT NOT NULL CONSTRAINT FK_vmk_video FOREIGN KEY REFERENCES dbo.match_videos(id) ON DELETE CASCADE,
    time_seconds INT NOT NULL,
    tag_code NVARCHAR(50) NULL CONSTRAINT FK_vmk_tag FOREIGN KEY REFERENCES dbo.video_tags(code),
    event_source NVARCHAR(30) NULL,
    event_id INT NULL,
    note NVARCHAR(500) NULL,
    favorite BIT NOT NULL CONSTRAINT DF_vmk_fav DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_vmk_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_vmk_time CHECK (time_seconds >= 0),
    CONSTRAINT CK_vmk_source CHECK (event_source IS NULL OR event_source IN (
        'goal', 'shot', 'card', 'substitution', 'custom'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vmk_video_time')
    CREATE INDEX IX_vmk_video_time ON dbo.video_markers(video_id, time_seconds);
GO

-- 4) Clips --------------------------------------------------------------------------
IF OBJECT_ID('dbo.video_clips', 'U') IS NULL
CREATE TABLE dbo.video_clips (
    id INT IDENTITY(1,1) PRIMARY KEY,
    video_id INT NOT NULL CONSTRAINT FK_vcl_video FOREIGN KEY REFERENCES dbo.match_videos(id) ON DELETE CASCADE,
    title NVARCHAR(200) NOT NULL,
    start_seconds INT NOT NULL,
    end_seconds INT NOT NULL,
    description NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_vcl_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_vcl_range CHECK (end_seconds > start_seconds AND start_seconds >= 0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vcl_video')
    CREATE INDEX IX_vcl_video ON dbo.video_clips(video_id);
GO
