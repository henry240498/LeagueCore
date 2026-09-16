import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export const STAFF_ROLES = [
  'DT',
  'ASISTENTE',
  'PF',
  'MEDICO',
  'KINESIOLOGO',
  'ANALISTA',
  'SCOUT',
  'DIRECTOR_DEPORTIVO',
  'DELEGADO',
  'OTRO',
] as const;

export const TEAM_CATEGORIES = [
  'PRIMERA',
  'RESERVA',
  'SUB20',
  'SUB17',
  'FEMENINO',
  'INFANTIL',
  'EQUIPO_B',
] as const;

export class CreateStaffDto {
  @IsString()
  @MaxLength(150)
  fullName!: string;

  @IsIn([...STAFF_ROLES])
  role!: string;

  @IsOptional() @IsIn([...TEAM_CATEGORIES]) teamCategory?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsString() @MaxLength(200) contact?: string;
}
