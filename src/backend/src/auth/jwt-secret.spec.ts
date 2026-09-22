import { resolveJwtSecret } from './auth.service';

// El secreto de desarrollo está publicado en el repositorio: si se usara en producción, cualquiera
// podría firmar un token de administrador. Estos tests fijan esa barrera.
describe('resolveJwtSecret', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('usa JWT_SECRET cuando está definido', () => {
    process.env.JWT_SECRET = 'un-secreto-real';
    expect(resolveJwtSecret()).toBe('un-secreto-real');
  });

  it('lanza en producción si JWT_SECRET falta', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('lanza en producción si JWT_SECRET está vacío o en blanco', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '   ';
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('permite el valor de desarrollo fuera de producción (no rompe el arranque local)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(typeof resolveJwtSecret()).toBe('string');
  });

  it('en producción con secreto definido no lanza', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secreto-de-produccion';
    expect(resolveJwtSecret()).toBe('secreto-de-produccion');
  });
});
