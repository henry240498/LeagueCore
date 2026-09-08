import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { normalizeText } from './name-match.util';

export interface RecordFieldProvenanceInput {
  entityType: string;
  entityId: number;
  fieldName: string;
  fieldValue: string | number | null | undefined;
  sourceName: string;
  sourceUrl?: string | null;
  syncRunId?: number | null;
  confidence?: number | null;
}

export interface RecordExternalIdInput {
  entityType: string;
  entityId: number;
  sourceName: string;
  sourceUrl?: string | null;
  externalId: string;
}

// Procedencia multifuente real (Decisiones 3-4): registra QUÉ fuente dijo QUÉ valor para QUÉ campo
// de QUÉ entidad (dbo.field_provenance, log apend-only -- nunca se pisa una fila anterior, ver
// migración 042) y qué identificadores externos tiene cada entidad (dbo.entity_external_ids, varios
// por entidad). Ambas tablas citan dbo.data_sources -- se resuelve/crea la fuente por nombre en vez
// de pedirle al llamador que ya sepa el id.
@Injectable()
export class ProvenanceService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async resolveOrCreateSource(sourceName: string, sourceUrl?: string | null): Promise<number> {
    const norm = normalizeText(sourceName);
    const existing = await this.pool.request().query('SELECT id, code, name FROM dbo.data_sources');
    for (const row of existing.recordset) {
      const codeNorm = normalizeText(row.code);
      const nameNorm = normalizeText(row.name);
      if (codeNorm === norm || nameNorm === norm || norm.includes(codeNorm) || codeNorm.includes(norm)) {
        return row.id;
      }
    }
    const code = (norm.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'fuente') as string;
    let baseUrl: string | null = null;
    if (sourceUrl) {
      try {
        baseUrl = new URL(sourceUrl).origin;
      } catch {
        baseUrl = null;
      }
    }
    const created = await this.pool
      .request()
      .input('code', sql.NVarChar, code)
      .input('name', sql.NVarChar, sourceName.slice(0, 200))
      .input('base_url', sql.NVarChar, baseUrl)
      .query(
        `INSERT INTO dbo.data_sources (code, name, base_url, source_type, status)
         OUTPUT INSERTED.id
         VALUES (@code, @name, @base_url, 'other', 'available')`,
      );
    return created.recordset[0].id;
  }

  async recordField(input: RecordFieldProvenanceInput): Promise<void> {
    if (input.fieldValue === undefined || input.fieldValue === null || input.fieldValue === '') return;
    const dataSourceId = await this.resolveOrCreateSource(input.sourceName, input.sourceUrl);
    await this.pool
      .request()
      .input('entity_type', sql.NVarChar, input.entityType)
      .input('entity_id', sql.Int, input.entityId)
      .input('field_name', sql.NVarChar, input.fieldName)
      .input('field_value', sql.NVarChar, String(input.fieldValue).slice(0, 500))
      .input('data_source_id', sql.Int, dataSourceId)
      .input('source_url', sql.NVarChar, input.sourceUrl ?? null)
      .input('sync_run_id', sql.Int, input.syncRunId ?? null)
      .input('confidence', sql.TinyInt, input.confidence ?? null)
      .query(
        `INSERT INTO dbo.field_provenance
           (entity_type, entity_id, field_name, field_value, data_source_id, source_url, sync_run_id, confidence)
         VALUES (@entity_type, @entity_id, @field_name, @field_value, @data_source_id, @source_url, @sync_run_id, @confidence)`,
      );
  }

  async recordExternalId(input: RecordExternalIdInput): Promise<void> {
    const dataSourceId = await this.resolveOrCreateSource(input.sourceName, input.sourceUrl);
    await this.pool
      .request()
      .input('entity_type', sql.NVarChar, input.entityType)
      .input('entity_id', sql.Int, input.entityId)
      .input('data_source_id', sql.Int, dataSourceId)
      .input('external_id', sql.NVarChar, input.externalId)
      .input('external_url', sql.NVarChar, input.sourceUrl ?? null)
      .query(
        `MERGE dbo.entity_external_ids AS target
         USING (SELECT @entity_type AS entity_type, @entity_id AS entity_id, @data_source_id AS data_source_id) AS src
           ON target.entity_type = src.entity_type AND target.entity_id = src.entity_id AND target.data_source_id = src.data_source_id
         WHEN MATCHED THEN UPDATE SET external_id = @external_id, external_url = @external_url
         WHEN NOT MATCHED THEN INSERT (entity_type, entity_id, data_source_id, external_id, external_url)
           VALUES (@entity_type, @entity_id, @data_source_id, @external_id, @external_url);`,
      );
  }

  async listForEntity(entityType: string, entityId: number) {
    const fields = await this.pool
      .request()
      .input('entity_type', sql.NVarChar, entityType)
      .input('entity_id', sql.Int, entityId)
      .query(
        `SELECT fp.field_name, fp.field_value, fp.source_url, fp.recorded_at, fp.confidence,
                ds.name AS source_name, ds.code AS source_code
         FROM dbo.field_provenance fp
         LEFT JOIN dbo.data_sources ds ON ds.id = fp.data_source_id
         WHERE fp.entity_type = @entity_type AND fp.entity_id = @entity_id
         ORDER BY fp.field_name, fp.recorded_at DESC`,
      );
    const externalIds = await this.pool
      .request()
      .input('entity_type', sql.NVarChar, entityType)
      .input('entity_id', sql.Int, entityId)
      .query(
        `SELECT eei.external_id, eei.external_url, ds.name AS source_name, ds.code AS source_code
         FROM dbo.entity_external_ids eei
         JOIN dbo.data_sources ds ON ds.id = eei.data_source_id
         WHERE eei.entity_type = @entity_type AND eei.entity_id = @entity_id`,
      );
    return {
      fields: fields.recordset.map((r) => ({
        fieldName: r.field_name,
        fieldValue: r.field_value,
        sourceName: r.source_name ?? r.source_code,
        sourceUrl: r.source_url,
        recordedAt: r.recorded_at,
        confidence: r.confidence,
      })),
      externalIds: externalIds.recordset.map((r) => ({
        sourceName: r.source_name ?? r.source_code,
        externalId: r.external_id,
        externalUrl: r.external_url,
      })),
    };
  }
}
