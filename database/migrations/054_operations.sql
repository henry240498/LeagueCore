-- LeagueCore - Fase 6: operativa (puntos 30-39, 43 del pedido).
--  - trainings: sesiones por equipo (fecha, duracion, objetivo, carga, rendimiento, video).
--  - training_exercises: biblioteca de ejercicios.
--  - training_attendance: asistencia por jugador/sesion.
--  - player_objectives / team_objectives: objetivos individuales y colectivos con seguimiento.
--  - alerts: notificaciones generadas por reglas (check) o manuales.
-- Analisis contextual, impacto de cambios y disciplina se derivan en vivo de datos reales
-- (matches/goals/shots/cards/fouls/substitutions) -- no se duplica nada.
-- Roles: se respetan los DOS roles existentes (admin/basico, migracion 028) -- no se crean otros.
-- Ejecutar con sqlcmd -f 65001 (UTF-8).

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

-- 1) Sesiones de entrenamiento -------------------------------------------------------
IF OBJECT_ID('dbo.trainings', 'U') IS NULL
CREATE TABLE dbo.trainings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    team_id INT NOT NULL CONSTRAINT FK_tr_team FOREIGN KEY REFERENCES dbo.teams(id) ON DELETE CASCADE,
    training_date DATE NOT NULL,
    duration_min INT NULL,
    objective NVARCHAR(300) NULL,
    load_level NVARCHAR(20) NULL,
    performance NVARCHAR(20) NULL,
    notes NVARCHAR(1000) NULL,
    video_url NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tr_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_tr_load CHECK (load_level IS NULL OR load_level IN ('BAJA', 'MEDIA', 'ALTA')),
    CONSTRAINT CK_tr_perf CHECK (performance IS NULL OR performance IN ('MALO', 'REGULAR', 'BUENO', 'EXCELENTE'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tr_team_date')
    CREATE INDEX IX_tr_team_date ON dbo.trainings(team_id, training_date DESC);
GO

-- 2) Biblioteca de ejercicios ------------------------------------------------------------
IF OBJECT_ID('dbo.training_exercises', 'U') IS NULL
CREATE TABLE dbo.training_exercises (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    category NVARCHAR(50) NULL,
    objective NVARCHAR(300) NULL,
    age_group NVARCHAR(30) NULL,
    duration_min INT NULL,
    players_count NVARCHAR(30) NULL,
    material NVARCHAR(300) NULL,
    diagram NVARCHAR(MAX) NULL,
    video_url NVARCHAR(1000) NULL,
    intensity NVARCHAR(20) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_te_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_te_intensity CHECK (intensity IS NULL OR intensity IN ('BAJA', 'MEDIA', 'ALTA'))
);
GO

-- 3) Asistencia --------------------------------------------------------------------------------
IF OBJECT_ID('dbo.training_attendance', 'U') IS NULL
CREATE TABLE dbo.training_attendance (
    training_id INT NOT NULL CONSTRAINT FK_ta_training FOREIGN KEY REFERENCES dbo.trainings(id) ON DELETE CASCADE,
    player_id INT NOT NULL CONSTRAINT FK_ta_player FOREIGN KEY REFERENCES dbo.players(id) ON DELETE CASCADE,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_ta_status DEFAULT N'ENTRENO',
    CONSTRAINT PK_ta PRIMARY KEY (training_id, player_id),
    CONSTRAINT CK_ta_status CHECK (status IN (
        'ENTRENO', 'NO_ENTRENO', 'LESIONADO', 'SANCIONADO', 'DESCANSO', 'SELECCION', 'PERMISO'))
);
GO

-- 4) Objetivos ------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.player_objectives', 'U') IS NULL
CREATE TABLE dbo.player_objectives (
    id INT IDENTITY(1,1) PRIMARY KEY,
    player_id INT NOT NULL CONSTRAINT FK_po_player FOREIGN KEY REFERENCES dbo.players(id) ON DELETE CASCADE,
    title NVARCHAR(200) NOT NULL,
    target_value DECIMAL(10,2) NULL,
    current_value DECIMAL(10,2) NULL,
    deadline DATE NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_po_status DEFAULT N'EN_CURSO',
    created_at DATETIME2 NOT NULL CONSTRAINT DF_po_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_po_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_po_status CHECK (status IN ('EN_CURSO', 'LOGRADO', 'VENCIDO'))
);
GO

IF OBJECT_ID('dbo.team_objectives', 'U') IS NULL
CREATE TABLE dbo.team_objectives (
    id INT IDENTITY(1,1) PRIMARY KEY,
    team_id INT NOT NULL CONSTRAINT FK_to_team FOREIGN KEY REFERENCES dbo.teams(id) ON DELETE CASCADE,
    title NVARCHAR(200) NOT NULL,
    target_value DECIMAL(10,2) NULL,
    current_value DECIMAL(10,2) NULL,
    deadline DATE NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_to_status DEFAULT N'EN_CURSO',
    created_at DATETIME2 NOT NULL CONSTRAINT DF_to_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_to_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_to_status CHECK (status IN ('EN_CURSO', 'LOGRADO', 'VENCIDO'))
);
GO

-- 5) Alertas ------------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.alerts', 'U') IS NULL
CREATE TABLE dbo.alerts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    kind NVARCHAR(50) NOT NULL,
    entity_type NVARCHAR(30) NULL,
    entity_id INT NULL,
    message NVARCHAR(500) NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_al_status DEFAULT N'PENDIENTE',
    created_at DATETIME2 NOT NULL CONSTRAINT DF_al_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_al_status CHECK (status IN ('PENDIENTE', 'LEIDA', 'RESUELTA'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_al_status')
    CREATE INDEX IX_al_status ON dbo.alerts(status, created_at DESC);
GO
