// DEV-ONLY: quitar antes de release. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
//
// Lista de credenciales de PRUEBA que muestra el panel oculto del login.
// Editá esta lista a mano: son cuentas ficticias/de test que vos controlás.
// NO poner acá credenciales reales de producción ni datos sensibles.

export type TestCredential = {
  /** Etiqueta descriptiva para mostrar en el panel (ej: "Administrador"). */
  label: string;
  username: string;
  password: string;
  /** Rol o alcance de la cuenta (informativo). */
  role?: string;
  /** Nota opcional (de dónde sale la cuenta, para qué sirve, etc.). */
  note?: string;
};

export const TEST_CREDENTIALS: TestCredential[] = [
  {
    label: 'Administrador',
    username: 'admin',
    password: '123456',
    role: 'admin',
    note: 'Usuario sembrado por scripts/seed-admin.js (contraseña temporal, obliga a cambiarla).',
  },
  // Agregá más cuentas de prueba acá a medida que las vayas creando.
];
