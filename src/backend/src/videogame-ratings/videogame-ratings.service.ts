import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateVideogameRatingDto } from './dto/create-videogame-rating.dto';

function toCamelRating(r: Record<string, any>) {
  return {
    id: r.id,
    playerId: r.player_id,
    videogameId: r.videogame_id,
    videogameName: r.videogame_name,
    editionId: r.videogame_edition_id,
    editionName: r.edition_name,
    year: r.year,
    overallRating: r.overall_rating,
    cardVariant: r.card_variant,
    positionIngame: r.position_ingame,
    sourceName: r.source_name,
    sourceUrl: r.source_url,
    retrievedAt: r.retrieved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Valoraciones históricas de videojuego (FIFA/EA SPORTS FC/PES/eFootball). Nunca sobrescribe entre
// ediciones -- cada (jugador, edición, variante de carta) es una fila propia (UNIQUE constraint,
// migración 035); re-enviar la MISMA edición actualiza esa fila puntual (upsert), nunca crea una
// segunda. Las 6 categorías (PAC/SHO/PAS/DRI/DEF/PHY, o el set de arquero) y los atributos
// detallados libres se guardan como hijos de la valoración -- separados de las estadísticas reales
// del jugador, que viven en match_player_stats/goals/cards y nunca se tocan desde acá.
@Injectable()
export class VideogameRatingsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async listVideogames() {
    const result = await this.pool.request().query('SELECT id, name, publisher, status FROM dbo.videogames ORDER BY name');
    return result.recordset;
  }

  async listCategories() {
    const result = await this.pool
      .request()
      .query('SELECT id, code, name_es AS nameEs, player_type AS playerType, sort_order AS sortOrder FROM dbo.player_videogame_attribute_categories ORDER BY player_type, sort_order');
    return result.recordset;
  }

  async listForPlayer(playerId: number) {
    const ratings = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT r.*, e.name AS edition_name, e.year, e.videogame_id, vg.name AS videogame_name
         FROM dbo.player_videogame_ratings r
         JOIN dbo.videogame_editions e ON e.id = r.videogame_edition_id
         JOIN dbo.videogames vg ON vg.id = e.videogame_id
         WHERE r.player_id = @player_id
         ORDER BY e.year ASC, vg.name ASC`,
      );
    if (ratings.recordset.length === 0) return [];

    const ratingIds = ratings.recordset.map((r) => r.id);
    const idParams = ratingIds.map((_, i) => `@id${i}`).join(',');
    const catRequest = this.pool.request();
    const detRequest = this.pool.request();
    ratingIds.forEach((id, i) => {
      catRequest.input(`id${i}`, sql.Int, id);
      detRequest.input(`id${i}`, sql.Int, id);
    });
    const [categories, detailed] = await Promise.all([
      catRequest.query(
        `SELECT s.rating_id, c.code, c.name_es AS nameEs, c.player_type AS playerType, c.sort_order AS sortOrder, s.score
         FROM dbo.player_videogame_category_scores s
         JOIN dbo.player_videogame_attribute_categories c ON c.id = s.category_id
         WHERE s.rating_id IN (${idParams})
         ORDER BY c.sort_order`,
      ),
      detRequest.query(
        `SELECT d.rating_id, d.attribute_code AS code, d.attribute_name_source AS nameSource, d.value, c.code AS categoryCode
         FROM dbo.player_videogame_detailed_attributes d
         LEFT JOIN dbo.player_videogame_attribute_categories c ON c.id = d.category_id
         WHERE d.rating_id IN (${idParams})`,
      ),
    ]);

    return ratings.recordset.map((r) => ({
      ...toCamelRating(r),
      categories: categories.recordset.filter((c) => c.rating_id === r.id).map((c) => ({ code: c.code, nameEs: c.nameEs, playerType: c.playerType, sortOrder: c.sortOrder, score: c.score })),
      detailedAttributes: detailed.recordset.filter((d) => d.rating_id === r.id).map((d) => ({ code: d.code, nameSource: d.nameSource, value: d.value, categoryCode: d.categoryCode })),
    }));
  }

  async upsertRating(playerId: number, dto: CreateVideogameRatingDto) {
    const player = await this.pool.request().input('id', sql.Int, playerId).query('SELECT TOP 1 1 FROM dbo.players WHERE id = @id');
    if (player.recordset.length === 0) throw new NotFoundException('Jugador no encontrado');

    const videogameId = await this.resolveOrCreateVideogame(dto.videogameName);
    const editionId = await this.resolveOrCreateEdition(videogameId, dto.editionName, dto.editionYear);
    const cardVariant = dto.cardVariant ?? 'base';

    const existing = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('edition_id', sql.Int, editionId)
      .input('card_variant', sql.NVarChar, cardVariant)
      .query('SELECT id FROM dbo.player_videogame_ratings WHERE player_id = @player_id AND videogame_edition_id = @edition_id AND card_variant = @card_variant');

    let ratingId: number;
    if (existing.recordset.length > 0) {
      ratingId = existing.recordset[0].id;
      await this.pool
        .request()
        .input('id', sql.Int, ratingId)
        .input('overall_rating', sql.SmallInt, dto.overallRating ?? null)
        .input('position_ingame', sql.NVarChar, dto.positionIngame ?? null)
        .input('source_name', sql.NVarChar, dto.sourceName)
        .input('source_url', sql.NVarChar, dto.sourceUrl)
        .query(
          `UPDATE dbo.player_videogame_ratings
           SET overall_rating = @overall_rating, position_ingame = @position_ingame,
               source_name = @source_name, source_url = @source_url,
               retrieved_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
           WHERE id = @id`,
        );
      await this.pool.request().input('id', sql.Int, ratingId).query('DELETE FROM dbo.player_videogame_category_scores WHERE rating_id = @id');
      await this.pool.request().input('id', sql.Int, ratingId).query('DELETE FROM dbo.player_videogame_detailed_attributes WHERE rating_id = @id');
    } else {
      const created = await this.pool
        .request()
        .input('player_id', sql.Int, playerId)
        .input('edition_id', sql.Int, editionId)
        .input('overall_rating', sql.SmallInt, dto.overallRating ?? null)
        .input('card_variant', sql.NVarChar, cardVariant)
        .input('position_ingame', sql.NVarChar, dto.positionIngame ?? null)
        .input('source_name', sql.NVarChar, dto.sourceName)
        .input('source_url', sql.NVarChar, dto.sourceUrl)
        .query(
          `INSERT INTO dbo.player_videogame_ratings
             (player_id, videogame_edition_id, overall_rating, card_variant, position_ingame, source_name, source_url, retrieved_at)
           OUTPUT INSERTED.id
           VALUES (@player_id, @edition_id, @overall_rating, @card_variant, @position_ingame, @source_name, @source_url, SYSUTCDATETIME())`,
        );
      ratingId = created.recordset[0].id;
    }

    const categoryCatalog = await this.pool.request().query('SELECT id, code FROM dbo.player_videogame_attribute_categories');
    const categoryIdByCode = new Map<string, number>(categoryCatalog.recordset.map((c: any) => [c.code, c.id]));

    for (const cat of dto.categories ?? []) {
      const categoryId = categoryIdByCode.get(cat.code);
      if (!categoryId) continue;
      await this.pool
        .request()
        .input('rating_id', sql.Int, ratingId)
        .input('category_id', sql.Int, categoryId)
        .input('score', sql.SmallInt, cat.score)
        .query('INSERT INTO dbo.player_videogame_category_scores (rating_id, category_id, score) VALUES (@rating_id, @category_id, @score)');
    }

    for (const attr of dto.detailedAttributes ?? []) {
      const categoryId = attr.categoryCode ? categoryIdByCode.get(attr.categoryCode) ?? null : null;
      await this.pool
        .request()
        .input('rating_id', sql.Int, ratingId)
        .input('category_id', sql.Int, categoryId)
        .input('attribute_code', sql.NVarChar, attr.code)
        .input('attribute_name_source', sql.NVarChar, attr.nameSource ?? null)
        .input('value', sql.SmallInt, attr.value ?? null)
        .query(
          `INSERT INTO dbo.player_videogame_detailed_attributes (rating_id, category_id, attribute_code, attribute_name_source, value)
           VALUES (@rating_id, @category_id, @attribute_code, @attribute_name_source, @value)`,
        );
    }

    return ratingId;
  }

  private async resolveOrCreateVideogame(name: string): Promise<number> {
    const existing = await this.pool.request().input('name', sql.NVarChar, name.trim()).query('SELECT id FROM dbo.videogames WHERE name = @name');
    if (existing.recordset.length > 0) return existing.recordset[0].id;
    const created = await this.pool
      .request()
      .input('name', sql.NVarChar, name.trim())
      .query('INSERT INTO dbo.videogames (name) OUTPUT INSERTED.id VALUES (@name)');
    return created.recordset[0].id;
  }

  private async resolveOrCreateEdition(videogameId: number, name: string, year: number): Promise<number> {
    const existing = await this.pool
      .request()
      .input('videogame_id', sql.Int, videogameId)
      .input('name', sql.NVarChar, name.trim())
      .query('SELECT id FROM dbo.videogame_editions WHERE videogame_id = @videogame_id AND name = @name');
    if (existing.recordset.length > 0) return existing.recordset[0].id;
    const created = await this.pool
      .request()
      .input('videogame_id', sql.Int, videogameId)
      .input('name', sql.NVarChar, name.trim())
      .input('year', sql.SmallInt, year)
      .input('sort_order', sql.Int, year)
      .query('INSERT INTO dbo.videogame_editions (videogame_id, name, year, sort_order) OUTPUT INSERTED.id VALUES (@videogame_id, @name, @year, @sort_order)');
    return created.recordset[0].id;
  }
}
