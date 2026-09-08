-- Fix: la migración 003 falló al crear el índice único filtrado de email porque
-- sqlcmd corre con QUOTED_IDENTIFIER OFF por default, y los índices filtrados lo requieren ON.
SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_email_filtered')
    CREATE UNIQUE INDEX UX_users_email_filtered ON dbo.users(email) WHERE email IS NOT NULL;
GO
