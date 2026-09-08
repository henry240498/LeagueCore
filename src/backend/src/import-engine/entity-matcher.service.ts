import { Injectable } from '@nestjs/common';
import type { MatchResult } from './types';

export interface ExistingEntityRef {
  id: number;
  name: string;
  externalSource?: string | null;
  externalId?: string | null;
}

// Igual que el resto del proyecto (players/officials/matches usan COLLATE Latin1_General_CI_AI
// para detectar duplicados por nombre ignorando acentos/mayúsculas), acá se normaliza el nombre
// antes de comparar en vez de introducir una librería nueva de similitud de texto.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Distancia de Levenshtein clásica -- suficiente para nombres de equipos/jugadores/competiciones
// (strings cortos), sin agregar una dependencia nueva para esto.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// Palabras genéricas de nombres de clubes reales -- sin filtrarlas, dos equipos SIN relación que
// sólo comparten un descriptor común (encontrado probando esta misma función: "Import Halcones" vs
// "Import Tigres" -- en datos reales el equivalente es moneda corriente: "Real Madrid" vs "Real
// Betis", "Deportivo Cali" vs "Deportivo Pasto", "Atlético Nacional" vs "Atlético Bucaramanga")
// generan un conflicto falso porque la única palabra "significativa" que ambos tienen es el
// descriptor, no el nombre real del club. No es una lista exhaustiva, cubre los patrones más
// comunes en español/inglés. "sportivo" agregado tras encontrar el mismo problema real importando
// la Primera División de Paraguay desde TheSportsDB: "Sportivo Luqueño" vs "Sportivo Ameliano" son
// dos clubes reales sin ninguna relación entre sí.
const GENERIC_CLUB_WORDS = new Set([
  'real', 'club', 'deportivo', 'deportiva', 'sportivo', 'atletico', 'atlético', 'atletica', 'atlética',
  'sporting', 'united', 'city', 'fc', 'cf', 'cd', 'ud', 'sc', 'ac', 'cfc', 'afc',
  'sociedad', 'asociacion', 'asociación', 'association', 'athletic', 'football', 'futbol', 'fútbol',
  'sport', 'municipal', 'provincial', 'nacional', 'independiente', 'estudiantes', 'gimnasia',
]);

// Superposición de palabras (tipo Jaccard) -- la distancia de Levenshtein sola falla en casos
// reales y comunes de nombres de clubes: "Olimpia Asunción" vs "Club Olimpia" comparten la palabra
// significativa "olimpia" pero tienen edit-distance alta a nivel de caracteres (orden distinto,
// palabras agregadas/quitadas). Se ignoran palabras de 2 letras o menos (artículos/conectores) y
// descriptores genéricos de club (arriba) para no inflar la superposición con ruido.
// Tope de 99, nunca 100: encontrado probando esta misma función -- "Club Zzqxlmpo" vs "Real
// Zzqxlmpo" reducen, tras filtrar los descriptores genéricos, al mismo único token significativo
// ("zzqxlmpo"), dando 100% de superposición -- pero en nombres de clubes reales el descriptor suele
// ser justamente lo que DISTINGUE a dos clubes distintos ("Real Madrid" ≠ cualquier otro "Madrid").
// Si esto devolviera 100, `match()` lo trataría como automáticamente seguro para enlazar sin
// revisión -- hay que reservar el 100% real (string completa idéntica) para eso, que ya lo resuelve
// `similarityPct` antes de llegar acá. Esto sólo debe ser una señal fuerte de conflicto, nunca una
// fusión automática.
// Palabras genéricas de nombres de COMPETICIÓN -- lista separada de GENERIC_CLUB_WORDS (esa es para
// clubes) porque son dominios distintos: "Copa"/"Torneo"/"Liga" no dicen nada sobre clubes, pero SÍ
// son la palabra más común y menos distintiva en nombres de competición. Bug real encontrado
// importando datos reales de Paraguay: "Copa Sudamericana" (candidato) vs "Copa América" (ya
// creada en la misma corrida) compartían únicamente el token "copa" -- 33.3% de superposición,
// suficiente para marcarlas como "posible duplicado" y bloquear el partido, pese a ser dos
// competiciones completamente distintas sin ninguna relación real entre sí.
const GENERIC_COMPETITION_WORDS = new Set([
  'copa', 'torneo', 'liga', 'campeonato', 'primera', 'segunda', 'tercera', 'division', 'división',
  'apertura', 'clausura', 'nacional', 'internacional', 'regional', 'zona', 'fase', 'grupo',
  'interligas', 'clasificatorio', 'clasificatorias', 'preparacion', 'preparación',
]);

function tokenOverlapPct(a: string, b: string, extraGenericWords: Set<string> = new Set()): number {
  const significant = (t: string) => t.length > 2 && !GENERIC_CLUB_WORDS.has(t) && !extraGenericWords.has(t);
  const tokensA = new Set(a.split(' ').filter(significant));
  const tokensB = new Set(b.split(' ').filter(significant));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  if (union === 0) return 0;
  const pct = Math.round((intersection / union) * 1000) / 10;
  return Math.min(pct, 99);
}

// Nota de diseño (encontrado probando esta misma función): tomar el máximo entre superposición de
// palabras y similitud por caracteres sonaba razonable, pero en la práctica el puntaje por
// caracteres es ruidoso para strings cortos SIN ninguna palabra en común ("Sportivo Trinidense" vs
// "Cerro Porteño" daba ~26% por azar de letras compartidas, suficiente para pasar un umbral bajo y
// generar un conflicto falso entre dos clubes sin ninguna relación real). Se prioriza la
// superposición de palabras cuando existe (señal confiable); sin ninguna palabra en común, sólo se
// confía en similitud por caracteres si es muy alta (typo/transliteración de un nombre corto).
function similarityPct(a: string, b: string, extraGenericWords?: Set<string>): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 100;
  const tokenPct = tokenOverlapPct(na, nb, extraGenericWords);
  if (tokenPct > 0) return tokenPct;
  const maxLen = Math.max(na.length, nb.length);
  const charPct = maxLen === 0 ? 100 : Math.max(0, Math.round((1 - levenshtein(na, nb) / maxLen) * 1000) / 10);
  return charPct >= 75 ? charPct : 0;
}

// Exportado para que los conectores puedan pedir explícitamente el filtro de palabras genéricas de
// COMPETICIÓN al comparar competiciones (ver GENERIC_COMPETITION_WORDS arriba) -- nunca se aplica
// por default a todos los tipos de entidad, sólo cuando el llamador sabe que está comparando
// nombres de competición.
export { GENERIC_COMPETITION_WORDS };

@Injectable()
export class EntityMatcherService {
  // Nunca resuelve solo un match ambiguo -- coincidencia exacta de external_id o de nombre
  // normalizado se resuelven automáticamente (mismo criterio que ya usa el proyecto para
  // duplicados obvios); cualquier otra cosa queda como conflicto para que decida un admin, nunca
  // se auto-fusiona con incertidumbre (regla explícita del pedido: "NO resolver automáticamente
  // conflictos importantes cuando exista incertidumbre").
  match(
    candidateName: string,
    candidateExternalId: string,
    sourceCode: string,
    existing: ExistingEntityRef[],
    extraGenericWords?: Set<string>,
  ): MatchResult {
    const exactExternal = existing.find((e) => e.externalSource === sourceCode && e.externalId === candidateExternalId);
    if (exactExternal) {
      return { decision: 'exact_external_match', existingEntityId: exactExternal.id, similarityPct: 100 };
    }

    let best: { entity: ExistingEntityRef; pct: number } | null = null;
    for (const e of existing) {
      const pct = similarityPct(candidateName, e.name, extraGenericWords);
      if (!best || pct > best.pct) best = { entity: e, pct };
    }

    // Umbral deliberadamente bajo (no 60%+): dado que nunca se auto-fusiona nada salvo el 100%
    // exacto, el costo de un falso "conflicto" es sólo que un admin lo revise y descarte -- el
    // costo de un falso "new" es crear un duplicado real. Se prefiere errar hacia marcar conflicto.
    if (!best || best.pct < 25) {
      return { decision: 'new', existingEntityId: null, similarityPct: best?.pct ?? 0 };
    }
    if (best.pct === 100) {
      return { decision: 'exact_name_match', existingEntityId: best.entity.id, similarityPct: 100 };
    }
    return { decision: 'conflict', existingEntityId: best.entity.id, similarityPct: best.pct };
  }
}
