import { passwordPolicyError } from './password-policy';

describe('passwordPolicyError', () => {
  it('rechaza contraseñas cortas', () => {
    expect(passwordPolicyError('Ab1!')).toMatch(/al menos 8 caracteres/);
  });

  it('rechaza contraseñas sin carácter especial', () => {
    expect(passwordPolicyError('Abcdefg1')).toMatch(/mayúscula, minúscula, número y carácter especial/);
  });

  it('rechaza contraseñas sin mayúscula', () => {
    expect(passwordPolicyError('abcdefg1!')).not.toBeNull();
  });

  it('acepta una contraseña válida', () => {
    expect(passwordPolicyError('Abcdefg1!')).toBeNull();
  });
});
