-- Habilita mostrar la cancha REAL de un estadio en la vista visual de partido (imagen de
-- referencia 3 del pedido: "la foto de fondo debe ser la cancha real donde se juega, si hay
-- registrada; si no, un genérico"). Sin esto no había ningún campo de imagen en dbo.venues.
SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO
ALTER TABLE dbo.venues ADD photo_url NVARCHAR(500) NULL;
GO
