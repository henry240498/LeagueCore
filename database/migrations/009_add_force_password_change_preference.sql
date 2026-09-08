-- LeagueCore - preferencia por usuario: ¿se exige cambiar la contraseña al iniciar sesión
-- después de un reseteo? El admin la controla desde Seguridad → Resetear contraseña.
--
-- Por pedido explícito del usuario (2026-08-20): para "admin" arranca DESACTIVADA (no se le
-- exige cambiar tras resetear), y para usuarios NUEVOS arranca ACTIVADA (vía el DEFAULT de la
-- columna, que sólo aplica a filas insertadas después de esta migración).

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

IF COL_LENGTH('dbo.users', 'force_password_change_on_reset') IS NULL
    ALTER TABLE dbo.users ADD force_password_change_on_reset BIT NOT NULL
        CONSTRAINT DF_users_force_pwd_change DEFAULT 1;
GO

UPDATE dbo.users SET force_password_change_on_reset = 0 WHERE username = 'admin';
GO
