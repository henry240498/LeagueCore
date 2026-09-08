-- LeagueCore - el fondo del formulario del Login (color_form_bg) ahora también admite
-- opacidad/transparencia configurable, no sólo color sólido (Seguridad → Configuración del Login).
-- 1.00 = totalmente opaco = comportamiento actual sin cambios; 0.00 = totalmente transparente.

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

IF COL_LENGTH('dbo.login_settings', 'color_form_bg_opacity') IS NULL
    ALTER TABLE dbo.login_settings ADD color_form_bg_opacity DECIMAL(3,2) NOT NULL
        CONSTRAINT DF_ls_color_form_bg_opacity DEFAULT 1.00;
GO
