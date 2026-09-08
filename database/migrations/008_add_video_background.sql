-- LeagueCore - fondo de Login como video (además de color/imagen).
-- background_type SÍ es un enum cerrado (a diferencia de competition_type/sport/status, que se
-- dejaron como texto libre): acá cada valor exige lógica de renderizado distinta en el frontend
-- (color vs <img> vs <video>), no es un dato de negocio que el futuro Módulo 2 vaya a parametrizar.

USE LeagueCore;
GO

IF COL_LENGTH('dbo.login_settings', 'background_type') IS NULL
    ALTER TABLE dbo.login_settings ADD background_type NVARCHAR(20) NOT NULL
        CONSTRAINT DF_ls_bg_type DEFAULT N'color'
        CONSTRAINT CK_ls_bg_type CHECK (background_type IN (N'color', N'image', N'video'));
GO
IF COL_LENGTH('dbo.login_settings', 'background_video_url') IS NULL
    ALTER TABLE dbo.login_settings ADD background_video_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.login_settings', 'background_video_muted') IS NULL
    ALTER TABLE dbo.login_settings ADD background_video_muted BIT NOT NULL
        CONSTRAINT DF_ls_bg_video_muted DEFAULT 1;
GO
IF COL_LENGTH('dbo.login_settings', 'background_video_start_seconds') IS NULL
    ALTER TABLE dbo.login_settings ADD background_video_start_seconds DECIMAL(6,2) NULL;
GO
IF COL_LENGTH('dbo.login_settings', 'background_video_end_seconds') IS NULL
    ALTER TABLE dbo.login_settings ADD background_video_end_seconds DECIMAL(6,2) NULL;
GO
