// Política de contraseñas: mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function passwordPolicyError(password: string): string | null {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'La contraseña debe incluir mayúscula, minúscula, número y carácter especial';
  }
  return null;
}
