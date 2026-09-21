import { NotFoundException } from '@nestjs/common';
import { DevController, isLocalRequest } from './dev.controller';

const req = (remoteAddress: string, headers: Record<string, string> = {}) =>
  ({ socket: { remoteAddress }, headers }) as any;

describe('isLocalRequest', () => {
  it('acepta un acceso directo desde localhost (IPv4, IPv6 y mapeada)', () => {
    expect(isLocalRequest(req('127.0.0.1'))).toBe(true);
    expect(isLocalRequest(req('::1'))).toBe(true);
    expect(isLocalRequest(req('::ffff:127.0.0.1'))).toBe(true);
  });

  it('rechaza una IP que no es loopback', () => {
    expect(isLocalRequest(req('192.168.1.20'))).toBe(false);
  });

  it('rechaza lo que llega por el túnel de Cloudflare aunque el socket sea loopback', () => {
    // cloudflared -> Vite -> backend: el socket es 127.0.0.1 pero trae cabeceras de proxy.
    expect(isLocalRequest(req('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9' }))).toBe(false);
    expect(isLocalRequest(req('127.0.0.1', { 'cf-ray': 'abc' }))).toBe(false);
    expect(isLocalRequest(req('::1', { 'x-forwarded-for': '203.0.113.9' }))).toBe(false);
  });
});

describe('DevController.getTestCredentials', () => {
  const controller = new DevController();
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('devuelve las credenciales a un acceso local', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_CREDENTIALS_REMOTE;
    expect(Array.isArray(controller.getTestCredentials(req('127.0.0.1')))).toBe(true);
  });

  it('responde 404 a un acceso por túnel', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_CREDENTIALS_REMOTE;
    expect(() => controller.getTestCredentials(req('127.0.0.1', { 'cf-ray': 'abc' }))).toThrow(NotFoundException);
  });

  it('permite el acceso remoto sólo si DEV_CREDENTIALS_REMOTE=true', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_CREDENTIALS_REMOTE = 'true';
    expect(Array.isArray(controller.getTestCredentials(req('127.0.0.1', { 'cf-ray': 'abc' })))).toBe(true);
  });

  it('siempre responde 404 en producción, aunque sea local o esté la variable', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_CREDENTIALS_REMOTE = 'true';
    expect(() => controller.getTestCredentials(req('127.0.0.1'))).toThrow(NotFoundException);
  });
});
