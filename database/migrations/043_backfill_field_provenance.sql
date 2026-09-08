SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO
-- Backfill único: los 96 jugadores + 1 oficial ya investigados en rondas anteriores (v49-v51, antes
-- de que existiera dbo.field_provenance) ya tienen una fuente real citada en la columna plana
-- external_source/external_url -- no se inventa nada nuevo, sólo se propaga esa misma fuente ya
-- verificada a nivel de CAMPO para cada dato realmente poblado, para que el nuevo sistema de
-- procedencia (migración 042) tenga datos reales desde el día uno en vez de arrancar vacío.

-- 1) Catálogo: una fila de dbo.data_sources por cada external_source distinto ya presente que
--    todavía no matchea ninguna fuente ya sembrada (comparación case-insensitive simple).
INSERT INTO dbo.data_sources (code, name, base_url, source_type, status)
SELECT DISTINCT
    LOWER(LEFT(REPLACE(REPLACE(REPLACE(p.external_source, ' ', '_'), '(', ''), ')', ''), 50)) AS code,
    p.external_source,
    NULL,
    'other',
    'available'
FROM dbo.players p
WHERE p.external_source IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.data_sources ds
      WHERE LOWER(ds.code) = LOWER(LEFT(REPLACE(REPLACE(REPLACE(p.external_source, ' ', '_'), '(', ''), ')', ''), 50))
         OR LOWER(ds.name) = LOWER(p.external_source)
         OR LOWER(p.external_source) LIKE '%' + LOWER(ds.code) + '%'
  );

INSERT INTO dbo.data_sources (code, name, base_url, source_type, status)
SELECT DISTINCT
    LOWER(LEFT(REPLACE(REPLACE(REPLACE(o.external_source, ' ', '_'), '(', ''), ')', ''), 50)) AS code,
    o.external_source,
    NULL,
    'other',
    'available'
FROM dbo.officials o
WHERE o.external_source IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.data_sources ds
      WHERE LOWER(ds.code) = LOWER(LEFT(REPLACE(REPLACE(REPLACE(o.external_source, ' ', '_'), '(', ''), ')', ''), 50))
         OR LOWER(ds.name) = LOWER(o.external_source)
         OR LOWER(o.external_source) LIKE '%' + LOWER(ds.code) + '%'
  );
GO

-- 2) field_provenance por cada campo realmente poblado, resolviendo la fuente por el mismo criterio.
IF NOT EXISTS (SELECT 1 FROM dbo.field_provenance WHERE entity_type = 'player')
BEGIN
    DECLARE @field NVARCHAR(30);
    DECLARE fields CURSOR LOCAL FOR
        SELECT v.field_name FROM (VALUES ('dateOfBirth'), ('birthPlace'), ('nationality'), ('position'), ('heightCm'), ('preferredFoot'), ('photoUrl')) AS v(field_name);
    OPEN fields;
    FETCH NEXT FROM fields INTO @field;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        INSERT INTO dbo.field_provenance (entity_type, entity_id, field_name, field_value, data_source_id, source_url)
        SELECT
            'player', p.id, @field,
            LEFT(CASE @field
                WHEN 'dateOfBirth' THEN CONVERT(NVARCHAR(10), p.date_of_birth, 23)
                WHEN 'birthPlace' THEN p.birth_place
                WHEN 'nationality' THEN p.nationality
                WHEN 'position' THEN p.position
                WHEN 'heightCm' THEN CONVERT(NVARCHAR(10), p.height_cm)
                WHEN 'preferredFoot' THEN p.preferred_foot
                WHEN 'photoUrl' THEN p.photo_url
            END, 500),
            ds.id,
            p.external_url
        FROM dbo.players p
        CROSS APPLY (SELECT TOP 1 id FROM dbo.data_sources ds
                      WHERE LOWER(ds.code) = LOWER(LEFT(REPLACE(REPLACE(REPLACE(p.external_source, ' ', '_'), '(', ''), ')', ''), 50))
                         OR LOWER(ds.name) = LOWER(p.external_source)
                         OR LOWER(p.external_source) LIKE '%' + LOWER(ds.code) + '%'
                      ORDER BY CASE WHEN LOWER(ds.name) = LOWER(p.external_source) THEN 0 ELSE 1 END) ds
        WHERE p.external_source IS NOT NULL
          AND CASE @field
                WHEN 'dateOfBirth' THEN CONVERT(NVARCHAR(10), p.date_of_birth, 23)
                WHEN 'birthPlace' THEN p.birth_place
                WHEN 'nationality' THEN p.nationality
                WHEN 'position' THEN p.position
                WHEN 'heightCm' THEN CONVERT(NVARCHAR(10), p.height_cm)
                WHEN 'preferredFoot' THEN p.preferred_foot
                WHEN 'photoUrl' THEN p.photo_url
              END IS NOT NULL;
        FETCH NEXT FROM fields INTO @field;
    END
    CLOSE fields;
    DEALLOCATE fields;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.field_provenance WHERE entity_type = 'official')
BEGIN
    DECLARE @ofield NVARCHAR(30);
    DECLARE ofields CURSOR LOCAL FOR
        SELECT v.field_name FROM (VALUES ('dateOfBirth'), ('city'), ('nationality'), ('photoUrl')) AS v(field_name);
    OPEN ofields;
    FETCH NEXT FROM ofields INTO @ofield;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        INSERT INTO dbo.field_provenance (entity_type, entity_id, field_name, field_value, data_source_id, source_url)
        SELECT
            'official', o.id, @ofield,
            LEFT(CASE @ofield
                WHEN 'dateOfBirth' THEN CONVERT(NVARCHAR(10), o.date_of_birth, 23)
                WHEN 'city' THEN o.city
                WHEN 'nationality' THEN o.nationality
                WHEN 'photoUrl' THEN o.photo_url
            END, 500),
            ds.id,
            o.external_url
        FROM dbo.officials o
        CROSS APPLY (SELECT TOP 1 id FROM dbo.data_sources ds
                      WHERE LOWER(ds.code) = LOWER(LEFT(REPLACE(REPLACE(REPLACE(o.external_source, ' ', '_'), '(', ''), ')', ''), 50))
                         OR LOWER(ds.name) = LOWER(o.external_source)
                         OR LOWER(o.external_source) LIKE '%' + LOWER(ds.code) + '%'
                      ORDER BY CASE WHEN LOWER(ds.name) = LOWER(o.external_source) THEN 0 ELSE 1 END) ds
        WHERE o.external_source IS NOT NULL
          AND CASE @ofield
                WHEN 'dateOfBirth' THEN CONVERT(NVARCHAR(10), o.date_of_birth, 23)
                WHEN 'city' THEN o.city
                WHEN 'nationality' THEN o.nationality
                WHEN 'photoUrl' THEN o.photo_url
              END IS NOT NULL;
        FETCH NEXT FROM ofields INTO @ofield;
    END
    CLOSE ofields;
    DEALLOCATE ofields;
END
GO

-- 3) entity_external_ids desde la columna plana external_id, cuando existe.
INSERT INTO dbo.entity_external_ids (entity_type, entity_id, data_source_id, external_id, external_url)
SELECT 'player', p.id, ds.id, p.external_id, p.external_url
FROM dbo.players p
CROSS APPLY (SELECT TOP 1 id FROM dbo.data_sources ds
              WHERE LOWER(ds.code) = LOWER(LEFT(REPLACE(REPLACE(REPLACE(p.external_source, ' ', '_'), '(', ''), ')', ''), 50))
                 OR LOWER(ds.name) = LOWER(p.external_source)
                 OR LOWER(p.external_source) LIKE '%' + LOWER(ds.code) + '%'
              ORDER BY CASE WHEN LOWER(ds.name) = LOWER(p.external_source) THEN 0 ELSE 1 END) ds
WHERE p.external_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.entity_external_ids e WHERE e.entity_type = 'player' AND e.entity_id = p.id AND e.data_source_id = ds.id);
GO
