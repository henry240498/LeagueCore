import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClubsService } from './clubs.service';

function createMockPool() {
  let clubs: any[] = [];
  let staff: any[] = [];
  let nextClubId = 1;
  let nextStaffId = 1;

  const request = () => {
    const inputs: Record<string, any> = {};
    const req: any = {
      input(name: string, ...rest: any[]) {
        inputs[name] = rest.length > 1 ? rest[1] : rest[0];
        return req;
      },
      async query(sqlText: string) {
        const q = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

        if (q.startsWith('select c.*,') && q.includes('from dbo.clubs c') && !q.includes('where c.id = @id')) {
          return {
            recordset: clubs.map((c) => ({ ...c, teams_count: 0, staff_count: 0 })),
          };
        }
        if (q.includes('from dbo.clubs c where c.id = @id')) {
          const row = clubs.find((c) => c.id === inputs.id);
          return { recordset: row ? [{ ...row, teams_count: 0, staff_count: staff.length }] : [] };
        }
        if (q.startsWith('insert into dbo.clubs')) {
          if (clubs.some((c) => c.name === inputs.name)) {
            const err: any = new Error('duplicate');
            err.number = 2627;
            throw err;
          }
          const row: any = { id: nextClubId++, created_at: new Date(), updated_at: new Date() };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          clubs.push(row);
          return { recordset: [{ id: row.id }] };
        }
        if (q.startsWith('update dbo.clubs')) {
          const row = clubs.find((c) => c.id === inputs.id);
          if (row) {
            for (const [k, v] of Object.entries(inputs)) {
              if (k !== 'id') row[k] = v;
            }
          }
          return { recordset: [] };
        }
        if (q.startsWith('delete from dbo.clubs')) {
          const row = clubs.find((c) => c.id === inputs.id);
          if (row?.name === 'CON_EQUIPOS') {
            const err: any = new Error('FK violation');
            err.number = 547;
            throw err;
          }
          clubs = clubs.filter((c) => c.id !== inputs.id);
          return { recordset: [] };
        }
        if (q.startsWith('select * from dbo.club_staff where club_id')) {
          return { recordset: staff.filter((s) => s.club_id === inputs.club_id) };
        }
        if (q.startsWith('insert into dbo.club_staff')) {
          const row: any = { id: nextStaffId++, created_at: new Date() };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          staff.push(row);
          return { recordset: [{ id: row.id }] };
        }
        if (q.startsWith('select * from dbo.club_staff where id = @id')) {
          return { recordset: staff.filter((s) => s.id === inputs.id) };
        }
        return { recordset: [] };
      },
    };
    return req;
  };

  return { request };
}

describe('ClubsService', () => {
  it('crea un club con identidad visual', async () => {
    const service = new ClubsService(createMockPool() as any);
    const created = await service.create({
      name: 'Club Olimpia',
      shortName: 'OLI',
      country: 'Paraguay',
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF',
    } as any);

    expect(created.id).toBe(1);
    expect(created.name).toBe('Club Olimpia');
  });

  it('rechaza un nombre duplicado con mensaje claro', async () => {
    const pool = createMockPool();
    const service = new ClubsService(pool as any);
    await service.create({ name: 'Duplicado' } as any);
    await expect(service.create({ name: 'Duplicado' } as any)).rejects.toThrow(BadRequestException);
  });

  it('lanza NotFoundException para un club inexistente', async () => {
    const service = new ClubsService(createMockPool() as any);
    await expect(service.getById(999)).rejects.toThrow(NotFoundException);
  });

  it('convierte un error de FK (547) al eliminar en un mensaje claro', async () => {
    const pool = createMockPool();
    const service = new ClubsService(pool as any);
    const created = await service.create({ name: 'CON_EQUIPOS' } as any);
    await expect(service.remove(created.id)).rejects.toThrow(BadRequestException);
  });

  it('agrega staff con rol al club', async () => {
    const pool = createMockPool();
    const service = new ClubsService(pool as any);
    const club = await service.create({ name: 'Con Staff' } as any);
    const member = await service.addStaff(club.id, { fullName: 'Prof. X', role: 'PF' } as any);
    expect(member.fullName).toBe('Prof. X');
    expect(member.role).toBe('PF');
  });
});
