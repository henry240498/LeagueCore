-- LeagueCore - ajuste al Módulo 8 (Partidos): faltas como evento individual, no sólo un
-- número agregado en dbo.match_team_stats.
--
-- El pedido original de Partidos (§18) ya las pedía como evento estructurado (Partido, Equipo,
-- Jugador cuando corresponda, Minuto, Tipo, Información adicional) — quedó pendiente en la
-- primera entrega. Mismo patrón exacto que dbo.offsides (migración 014): equipo que comete la
-- falta explícito, jugador opcional (no siempre se registra quién la cometió), minuto con tiempo
-- añadido y periodo. La falta RECIBIDA es simplemente la del equipo contrario — no hace falta una
-- segunda columna para eso.

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

IF OBJECT_ID('dbo.fouls', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.fouls (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        match_id        INT             NOT NULL,
        team_id         INT             NOT NULL,
        player_id       INT             NULL,
        minute          SMALLINT        NULL,
        minute_extra    SMALLINT        NULL,
        period          NVARCHAR(20)    NULL,
        card_id         INT             NULL,
        note            NVARCHAR(200)   NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_fouls_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_fouls_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_fouls_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_fouls_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        -- Una falta puede haber derivado en una tarjeta ya registrada en dbo.cards — se referencia
        -- en vez de duplicar tipo/motivo, para no tener dos fuentes de verdad sobre lo mismo.
        CONSTRAINT FK_fouls_card FOREIGN KEY (card_id) REFERENCES dbo.cards(id),
        CONSTRAINT CK_fouls_period CHECK (period IS NULL OR period IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second'))
    );
    CREATE INDEX IX_fouls_match_id ON dbo.fouls(match_id);
END
GO
