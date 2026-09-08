import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { OfficialsService } from '../officials/officials.service';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { SubmitResearchedOfficialDto } from './dto/submit-researched-official.dto';
import { bestMatch, normalizeText, PersonCandidate } from './name-match.util';
import { PhotoAcquisitionService } from './photo-acquisition.service';
import { ProvenanceService } from './provenance.service';

export interface OfficialResearchResult {
  status: 'new' | 'updated' | 'unchanged' | 'conflict';
  officialId?: number;
  fieldsUpdated?: string[];
  photoAcquired?: boolean;
}

const ENRICHABLE_FIELDS: Array<keyof SubmitResearchedOfficialDto> = ['dateOfBirth', 'city', 'nationality'];

// Mismo tratamiento que PlayerResearchService, aplicado a oficiales/árbitros (Parte 6 del pedido):
// nunca duplica una persona por haber arbitrado distintas competiciones -- identifica primero,
// enriquece si ya existe, crea sólo si es genuinamente nueva.
@Injectable()
export class OfficialResearchService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly officials: OfficialsService,
    private readonly tracker: SyncRunTracker,
    private readonly photos: PhotoAcquisitionService,
    private readonly provenance: ProvenanceService,
  ) {}

  async submit(runId: number, input: SubmitResearchedOfficialDto): Promise<OfficialResearchResult> {
    await this.tracker.bumpCounter(runId, 'total_analyzed');
    const label = `${input.firstName} ${input.lastName}`;

    const candidates = await this.loadCandidates();
    const { verdict, best } = bestMatch(
      { firstName: input.firstName, lastName: input.lastName, dateOfBirth: input.dateOfBirth, nationality: input.nationality },
      candidates,
    );

    if (verdict === 'ambiguous' && best) {
      await this.tracker.bumpCounter(runId, 'total_conflicts');
      await this.tracker.recordConflict(runId, 'official', best.candidate.id, input.externalId ?? input.sourceUrl, label, best.score, {
        dateOfBirth: input.dateOfBirth ?? null,
        nationality: input.nationality ?? null,
        sourceUrl: input.sourceUrl,
      });
      await this.tracker.log(runId, 'warning', `Posible duplicado (${best.score}%): ${label}`, 'official', label);
      return { status: 'conflict' };
    }

    let officialId: number;
    let fieldsUpdated: string[] = [];

    if (verdict === 'same_person' && best) {
      officialId = best.candidate.id;
      fieldsUpdated = await this.enrich(runId, officialId, input);
      if (fieldsUpdated.length > 0) {
        await this.tracker.bumpCounter(runId, 'total_updated');
        await this.tracker.log(runId, 'success', `Oficial enriquecido (${fieldsUpdated.join(', ')}): ${label}`, 'official', label);
      } else {
        await this.tracker.bumpCounter(runId, 'total_unchanged');
        await this.tracker.log(runId, 'info', `Oficial ya identificado, sin datos nuevos: ${label}`, 'official', label);
      }
    } else {
      let officialTypeId: number | null = null;
      if (input.officialTypeName) {
        officialTypeId = await this.resolveOfficialTypeId(input.officialTypeName);
      }
      if (!officialTypeId) {
        officialTypeId = await this.resolveOfficialTypeId('Otro');
      }
      if (!officialTypeId) {
        await this.tracker.recordError(runId, 'official', label, 'tipo_inexistente', `No se pudo resolver un tipo de oficial para "${label}" (buscado: "${input.officialTypeName ?? 'sin especificar'}").`);
        return { status: 'conflict' };
      }
      const created = await this.officials.create({
        firstName: input.firstName,
        lastName: input.lastName,
        officialTypeId,
        dateOfBirth: input.dateOfBirth,
        city: input.city,
        nationality: input.nationality,
      } as any);
      officialId = created.id;
      await this.tracker.bumpCounter(runId, 'total_new');
      await this.tracker.log(runId, 'success', `Oficial nuevo: ${label}`, 'official', label);
    }

    await this.setProvenance(runId, officialId, input);

    let photoAcquired = false;
    if (input.photoUrl) {
      const currentPhoto = await this.pool.request().input('id', sql.Int, officialId).query('SELECT photo_url FROM dbo.officials WHERE id = @id');
      const hasPhoto = !!currentPhoto.recordset[0]?.photo_url;
      if (!hasPhoto) {
        const localUrl = await this.photos.acquire('officials', input.photoUrl);
        if (localUrl) {
          await this.officials.update(officialId, { photoUrl: localUrl } as any);
          photoAcquired = true;
          const photoSource = input.fieldSources?.photoUrl ?? { sourceName: input.sourceName, sourceUrl: input.sourceUrl };
          await this.provenance.recordField({
            entityType: 'official',
            entityId: officialId,
            fieldName: 'photoUrl',
            fieldValue: input.photoUrl,
            sourceName: photoSource.sourceName,
            sourceUrl: photoSource.sourceUrl,
            syncRunId: runId,
          });
          await this.tracker.log(runId, 'success', `Fotografía obtenida: ${label}`, 'official', label);
        } else {
          await this.tracker.log(runId, 'warning', `Fotografía no pudo descargarse/validarse: ${label}`, 'official', label);
        }
      }
    }

    return { status: verdict === 'same_person' ? (fieldsUpdated.length > 0 ? 'updated' : 'unchanged') : 'new', officialId, fieldsUpdated, photoAcquired };
  }

  private async loadCandidates(): Promise<PersonCandidate[]> {
    const result = await this.pool.request().query('SELECT id, first_name, last_name, date_of_birth, nationality FROM dbo.officials');
    return result.recordset.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, dateOfBirth: r.date_of_birth, nationality: r.nationality }));
  }

  private async enrich(runId: number, officialId: number, input: SubmitResearchedOfficialDto): Promise<string[]> {
    const current = await this.officials.getById(officialId);
    const patch: Record<string, unknown> = {};
    const updated: string[] = [];

    for (const field of ENRICHABLE_FIELDS) {
      const newVal = input[field];
      if (newVal === undefined || newVal === null || newVal === '') continue;
      const oldVal = (current as any)[field];
      if (oldVal === undefined || oldVal === null || oldVal === '') {
        patch[field] = newVal;
        updated.push(field);
        continue;
      }
      const oldStr = field === 'dateOfBirth' ? String(oldVal).slice(0, 10) : normalizeText(String(oldVal));
      const newStr = field === 'dateOfBirth' ? String(newVal).slice(0, 10) : normalizeText(String(newVal));
      if (oldStr !== newStr) {
        await this.tracker.recordFieldDiffConflict(runId, 'official', officialId, { [field]: oldVal }, { [field]: newVal }, { [field]: newVal });
      }
    }

    if (Object.keys(patch).length > 0) {
      await this.officials.update(officialId, patch as any);
    }
    return updated;
  }

  private async setProvenance(runId: number, officialId: number, input: SubmitResearchedOfficialDto) {
    // Mismo límite real que en PlayerResearchService: dbo.officials.external_source es NVARCHAR(50).
    // Igual que con jugadores, esta columna plana ya no es la única procedencia -- field_provenance
    // registra la fuente real de cada campo (Decisión 3).
    await this.pool
      .request()
      .input('id', sql.Int, officialId)
      .input('data_origin', sql.NVarChar, 'research')
      .input('external_source', sql.NVarChar, input.sourceName.slice(0, 50))
      .input('external_id', sql.NVarChar, input.externalId ?? null)
      .input('external_url', sql.NVarChar, input.sourceUrl)
      .query(
        `UPDATE dbo.officials
         SET data_origin = CASE WHEN data_origin = 'manual' THEN @data_origin ELSE data_origin END,
             external_source = COALESCE(external_source, @external_source),
             external_id = COALESCE(external_id, @external_id),
             external_url = COALESCE(external_url, @external_url),
             last_synced_at = SYSUTCDATETIME()
         WHERE id = @id`,
      );

    for (const field of ENRICHABLE_FIELDS) {
      const value = input[field];
      if (value === undefined || value === null || value === ('' as any)) continue;
      const src = input.fieldSources?.[field] ?? { sourceName: input.sourceName, sourceUrl: input.sourceUrl };
      await this.provenance.recordField({
        entityType: 'official',
        entityId: officialId,
        fieldName: field,
        fieldValue: value as string,
        sourceName: src.sourceName,
        sourceUrl: src.sourceUrl,
        syncRunId: runId,
      });
    }

    if (input.externalId) {
      await this.provenance.recordExternalId({
        entityType: 'official',
        entityId: officialId,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        externalId: input.externalId,
      });
    }
  }

  private async resolveOfficialTypeId(name: string): Promise<number | null> {
    const all = await this.pool.request().query('SELECT id, name FROM dbo.official_types');
    const target = normalizeText(name);
    const found = all.recordset.find((r) => normalizeText(r.name) === target);
    return found?.id ?? null;
  }
}
