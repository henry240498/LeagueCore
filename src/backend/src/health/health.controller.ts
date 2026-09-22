import { Controller, Get, Inject } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

// Endpoint público de salud (sin auth, para chequeos de disponibilidad). No expone detalles
// internos como el nombre de la base o la hora del servidor: sólo informa si la API está arriba y
// si la base de datos responde. Tampoco lanza 500 cuando la base está caída (devuelve 'degraded').
@Controller('health')
export class HealthController {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  @Get()
  async check() {
    let dbConnected = false;
    try {
      await this.pool.request().query('SELECT 1');
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    return {
      status: dbConnected ? 'ok' : 'degraded',
      api: 'LeagueCore API v1',
      database: { connected: dbConnected },
    };
  }
}
