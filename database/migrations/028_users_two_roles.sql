-- Reduce dbo.users.role a exactamente dos valores (admin/basico), a pedido explícito ("solamente
-- existirán DOS roles en LeagueCore, no crear otros"). 'editor'/'viewer' nunca se usaron en ningún
-- lado del código (sólo estaban permitidos por el CHECK, sin lógica ni datos reales detrás) -- se
-- verificó `SELECT DISTINCT role FROM dbo.users` antes de escribir esta migración: sólo existía
-- 'admin', así que no hace falta ningún UPDATE de datos.
SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

ALTER TABLE dbo.users DROP CONSTRAINT CK_users_role;
GO

ALTER TABLE dbo.users ADD CONSTRAINT CK_users_role CHECK (role IN ('admin', 'basico'));
GO
