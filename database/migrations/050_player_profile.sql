-- LeagueCore - Fase 2: expediente avanzado del jugador (puntos 2-5 del pedido).
--  - players: peso + estado contractual (altura/pierna/foto ya existian).
--  - player_physical_records: snapshot fisico por fecha (velocidad, distancias, sprints,
--    aceleraciones, carga, Player Load, ACWR, fatiga, disponibilidad) + GPS/frecuencia cardiaca.
--  - player_technical_ratings: valoracion 1-100 por atributo (radar). Flexible por filas para
--    no alterar el esquema cuando se agreguen atributos.
--  - player_injuries: historial de lesiones (la disponibilidad se deriva de aca).
-- Ejecutar con sqlcmd -f 65001 (UTF-8).

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

-- 1) Columnas base en players ------------------------------------------------
IF COL_LENGTH('dbo.players', 'weight_kg') IS NULL
    ALTER TABLE dbo.players ADD weight_kg SMALLINT NULL;
GO
IF COL_LENGTH('dbo.players', 'contract_status') IS NULL
    ALTER TABLE dbo.players ADD contract_status NVARCHAR(30) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_players_contract_status')
    ALTER TABLE dbo.players ADD CONSTRAINT CK_players_contract_status
        CHECK (contract_status IS NULL OR contract_status IN (
            'VIGENTE', 'POR_VENCER', 'VENCIDO', 'A_PRESTAMO', 'LIBRE', 'JUVENIL'));
GO

-- 2) Registros fisicos --------------------------------------------------------
IF OBJECT_ID('dbo.player_physical_records', 'U') IS NULL
CREATE TABLE dbo.player_physical_records (
    id INT IDENTITY(1,1) PRIMARY KEY,
    player_id INT NOT NULL CONSTRAINT FK_pphys_player FOREIGN KEY REFERENCES dbo.players(id) ON DELETE CASCADE,
    recorded_at DATE NOT NULL CONSTRAINT DF_pphys_recorded_at DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    max_speed_kmh DECIMAL(5,2) NULL,
    avg_speed_kmh DECIMAL(5,2) NULL,
    distance_m INT NULL,
    hi_distance_m INT NULL,
    sprints INT NULL,
    accelerations INT NULL,
    decelerations INT NULL,
    direction_changes INT NULL,
    hi_minutes INT NULL,
    player_load DECIMAL(8,2) NULL,
    acwr DECIMAL(4,2) NULL,
    heart_rate_avg SMALLINT NULL,
    external_load DECIMAL(8,2) NULL,
    internal_load DECIMAL(8,2) NULL,
    fatigue SMALLINT NULL CONSTRAINT CK_pphys_fatigue CHECK (fatigue IS NULL OR (fatigue >= 0 AND fatigue <= 100)),
    availability NVARCHAR(20) NULL CONSTRAINT DF_pphys_availability DEFAULT N'DISPONIBLE',
    source NVARCHAR(30) NULL CONSTRAINT DF_pphys_source DEFAULT N'manual',
    note NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_pphys_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_pphys_availability CHECK (availability IS NULL OR availability IN (
        'DISPONIBLE', 'DUDOSO', 'LESIONADO', 'SANCIONADO', 'DESCANSO', 'SELECCION', 'PERMISO')),
    CONSTRAINT CK_pphys_source CHECK (source IS NULL OR source IN ('manual', 'gps', 'wearable', 'imported'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pphys_player_date')
    CREATE INDEX IX_pphys_player_date ON dbo.player_physical_records(player_id, recorded_at DESC);
GO

-- 3) Valoraciones tecnicas 1-100 ----------------------------------------------
IF OBJECT_ID('dbo.player_technical_ratings', 'U') IS NULL
CREATE TABLE dbo.player_technical_ratings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    player_id INT NOT NULL CONSTRAINT FK_ptr_player FOREIGN KEY REFERENCES dbo.players(id) ON DELETE CASCADE,
    attribute NVARCHAR(30) NOT NULL,
    value SMALLINT NOT NULL,
    evaluated_at DATE NOT NULL CONSTRAINT DF_ptr_evaluated_at DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    evaluator NVARCHAR(150) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_ptr_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ptr_value CHECK (value >= 1 AND value <= 100),
    CONSTRAINT CK_ptr_attribute CHECK (attribute IN (
        'VELOCIDAD', 'REGATE', 'PASE_CORTO', 'PASE_LARGO', 'PASE_PROGRESIVO', 'PASE_CLAVE',
        'CENTRO', 'CONTROL', 'CONDUCCION', 'TIRO', 'FINALIZACION', 'JUEGO_AEREO',
        'BALON_PARADO', 'RECUPERACION', 'ENTRADA', 'INTERCEPCION', 'DESPEJE',
        'VISION', 'DEFENSA', 'FISICO', 'PORTERIA'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ptr_player_attr_date')
    CREATE UNIQUE INDEX UX_ptr_player_attr_date ON dbo.player_technical_ratings(player_id, attribute, evaluated_at);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ptr_player')
    CREATE INDEX IX_ptr_player ON dbo.player_technical_ratings(player_id);
GO

-- 4) Historial de lesiones -----------------------------------------------------
IF OBJECT_ID('dbo.player_injuries', 'U') IS NULL
CREATE TABLE dbo.player_injuries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    player_id INT NOT NULL CONSTRAINT FK_pinj_player FOREIGN KEY REFERENCES dbo.players(id) ON DELETE CASCADE,
    injury_type NVARCHAR(100) NOT NULL,
    body_part NVARCHAR(100) NULL,
    severity NVARCHAR(20) NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_pinj_status DEFAULT N'ACTIVA',
    note NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_pinj_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_pinj_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_pinj_severity CHECK (severity IS NULL OR severity IN ('LEVE', 'MODERADA', 'GRAVE')),
    CONSTRAINT CK_pinj_status CHECK (status IN ('ACTIVA', 'RECUPERADO')),
    CONSTRAINT CK_pinj_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pinj_player')
    CREATE INDEX IX_pinj_player ON dbo.player_injuries(player_id, start_date DESC);
GO
