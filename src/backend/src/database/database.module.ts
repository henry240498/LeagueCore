import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import * as sql from 'mssql';

export const SQL_POOL = 'SQL_POOL';

@Global()
@Module({
  providers: [
    {
      provide: SQL_POOL,
      useFactory: async (): Promise<sql.ConnectionPool> => {
        return sql.connect({
          server: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 1433),
          database: process.env.DB_NAME ?? 'LeagueCore',
          user: process.env.DB_USER ?? 'sa',
          password: process.env.DB_PASSWORD ?? '',
          options: {
            encrypt: false,
            trustServerCertificate: true,
          },
        });
      },
    },
  ],
  exports: [SQL_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async onModuleDestroy() {
    await this.pool.close();
  }
}
