import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { UpdateLoginSettingsDto } from './dto/update-login-settings.dto';

const COLUMN_MAP: Record<string, string> = {
  systemName: 'system_name',
  title: 'title',
  subtitle: 'subtitle',
  welcomeMessage: 'welcome_message',
  showLogo: 'show_logo',
  showSubtitle: 'show_subtitle',
  showWelcomeMessage: 'show_welcome_message',
  logoMainUrl: 'logo_main_url',
  logoLoginUrl: 'logo_login_url',
  backgroundType: 'background_type',
  backgroundImageUrl: 'background_image_url',
  backgroundVideoUrl: 'background_video_url',
  backgroundVideoMuted: 'background_video_muted',
  backgroundVideoStartSeconds: 'background_video_start_seconds',
  backgroundVideoEndSeconds: 'background_video_end_seconds',
  backgroundColor: 'background_color',
  backgroundPosition: 'background_position',
  backgroundSize: 'background_size',
  backgroundRepeat: 'background_repeat',
  overlayColor: 'overlay_color',
  overlayOpacity: 'overlay_opacity',
  colorPrimary: 'color_primary',
  colorSecondary: 'color_secondary',
  colorText: 'color_text',
  colorTextSecondary: 'color_text_secondary',
  colorFormBg: 'color_form_bg',
  colorFormBgOpacity: 'color_form_bg_opacity',
  colorButton: 'color_button',
  colorButtonHover: 'color_button_hover',
  colorError: 'color_error',
  colorBorder: 'color_border',
  colorInputBg: 'color_input_bg',
  buttonText: 'button_text',
  placeholderUsername: 'placeholder_username',
  placeholderPassword: 'placeholder_password',
};

// columnas de medios (logos/fondo) sin un valor "por defecto" real — no hay logo/imagen/video
// predeterminado, así que se limpian explícitamente a NULL en el reset en vez de usar DEFAULT.
const MEDIA_COLUMNS = [
  'logo_main_url',
  'logo_login_url',
  'background_image_url',
  'background_video_url',
];
const RESETTABLE_COLUMNS = Object.values(COLUMN_MAP).filter((c) => !MEDIA_COLUMNS.includes(c));

function toCamel(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [camel, snake] of Object.entries(COLUMN_MAP)) {
    out[camel] = row[snake];
  }
  out.updatedAt = row.updated_at;
  return out;
}

@Injectable()
export class LoginSettingsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async get() {
    const result = await this.pool
      .request()
      .query('SELECT * FROM dbo.login_settings WHERE id = 1');
    return toCamel(result.recordset[0]);
  }

  async update(dto: UpdateLoginSettingsDto, userId: number) {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.get();

    const request = this.pool.request();
    const setClauses: string[] = [];
    for (const [camel, value] of entries) {
      const column = COLUMN_MAP[camel];
      if (!column) continue;
      request.input(column, value);
      setClauses.push(`${column} = @${column}`);
    }
    setClauses.push('updated_at = SYSUTCDATETIME()', 'updated_by = @updated_by');
    request.input('updated_by', sql.Int, userId);

    await request.query(
      `UPDATE dbo.login_settings SET ${setClauses.join(', ')} WHERE id = 1`,
    );
    return this.get();
  }

  async setImage(
    field: 'logoMainUrl' | 'logoLoginUrl' | 'backgroundImageUrl' | 'backgroundVideoUrl',
    url: string,
    userId: number,
  ) {
    const column = COLUMN_MAP[field];
    await this.pool
      .request()
      .input('url', sql.NVarChar, url)
      .input('updated_by', sql.Int, userId)
      .query(
        `UPDATE dbo.login_settings SET ${column} = @url, updated_at = SYSUTCDATETIME(), updated_by = @updated_by WHERE id = 1`,
      );
    return this.get();
  }

  async reset(userId: number) {
    const resetClauses = RESETTABLE_COLUMNS.map((c) => `${c} = DEFAULT`);
    const nullClauses = MEDIA_COLUMNS.map((c) => `${c} = NULL`);
    await this.pool
      .request()
      .input('updated_by', sql.Int, userId)
      .query(
        `UPDATE dbo.login_settings
         SET ${[...resetClauses, ...nullClauses].join(', ')},
             updated_at = SYSUTCDATETIME(), updated_by = @updated_by
         WHERE id = 1`,
      );
    return this.get();
  }
}
