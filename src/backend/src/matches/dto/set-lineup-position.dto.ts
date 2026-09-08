import { IsNumber, Max, Min } from 'class-validator';

export class SetLineupPositionDto {
  @IsNumber() @Min(0) @Max(100) posX!: number;
  @IsNumber() @Min(0) @Max(100) posY!: number;
}
