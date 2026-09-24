import { describe, expect, it } from 'vitest'
import { normalizeHeader, parseCsv } from './csv'

describe('parseCsv', () => {
  it('usa la primera fila como encabezado y normaliza las claves', () => {
    const rows = parseCsv('Player ID,Pos X,Pos Y\n7,50,60')
    expect(rows).toEqual([{ playerid: '7', posx: '50', posy: '60' }])
  })

  it('acepta comas dentro de un campo entrecomillado', () => {
    const rows = parseCsv('playerId,source\n7,"GPS, modelo X"')
    expect(rows[0].source).toBe('GPS, modelo X')
  })

  it('soporta comillas escapadas', () => {
    const rows = parseCsv('playerId,source\n7,"dijo ""hola"""')
    expect(rows[0].source).toBe('dijo "hola"')
  })

  it('ignora el BOM que agrega Excel', () => {
    const rows = parseCsv('﻿playerId,posX\n7,50')
    expect(rows[0].playerid).toBe('7')
  })

  it('acepta punto y coma o tabulación como separador', () => {
    expect(parseCsv('playerId;posX\n7;50')[0].posx).toBe('50')
    expect(parseCsv('playerId\tposX\n7\t50')[0].posx).toBe('50')
  })

  it('descarta filas vacías', () => {
    const rows = parseCsv('playerId,posX\n7,50\n\n8,60\n')
    expect(rows).toHaveLength(2)
  })

  it('devuelve vacío con texto vacío', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('   ')).toEqual([])
  })

  it('normaliza tildes y espacios en los encabezados', () => {
    expect(normalizeHeader('  Métrica Valor ')).toBe('metricavalor')
    expect(normalizeHeader('pos_x')).toBe('posx')
  })
})
