import { Controller, Get, Inject } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  @Get()
  async check() {
    const result = await this.pool
      .request()
      .query('SELECT DB_NAME() AS database_name, GETDATE() AS server_time');

    return {
      status: 'ok',
      api: 'LeagueCore API v1',
      database: result.recordset[0],
    };
  }
}
