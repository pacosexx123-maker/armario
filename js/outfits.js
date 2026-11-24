// Generador de outfits con puntuación de armonía de color.

import { infoColor, difTono } from './color.js';
import { categoria } from './categories.js';

const tiene = (p, e) => (p.estilos || []).includes(e);

export const ESTILOS_OUTFIT = {
  formal:    { nombre: 'Formal',    acepta: (p) => tiene(p, 'formal') },
  arreglado: { nombre: 'Arreglado', acepta: (p) => tiene(p, 'formal') || tiene(p, 'casual') },
  informal:  { nombre: 'Informal',  acepta: (p) => tiene(p, 'casual') },
  deportivo: { nombre: 'Deportivo', acepta: (p) => tiene(p, 'deporte') },
};

const MAX_COMBINACIONES = 4000;
const ORDEN_SLOT = { arriba: 0, vestido: 0, abajo: 1, calzado: 2, abrigo: 3, complemento: 4 };

export const claveOutfit = (ids) => [...ids].sort().join('|');

function aleatorio(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------- Puntuación ---------- */

function puntuar(prendas, estilo) {
  const infos = prendas.map((p) => infoColor(p.color.hex, p.categoria));
  let suma = 0, pares = 0;

  for (let i = 0; i < infos.length; i++) {
    for (let j = i + 1; j < infos.length; j++) {
      const a = infos[i], b = infos[j];
      pares++;
      if (a.neutro && b.neutro) suma += 1;
      else if (a.neutro || b.neutro) suma += 1.5;          // los neutros combinan con todo
      else {
        const d = difTono(a.hue, b.hue);
        if (d < 30) suma += 2.5;                             // análogos
        else if (d >= 150) suma += 2;                        // complementarios
        else if (a.saturado && b.saturado) suma -= 3;        // dos colores fuertes que chocan
        else suma -= 0.5;
      }
    }
  }
  let puntos = pares ? suma / pares : 0;

  const acentos = infos.filter((c) => !c.neutro);
  if (acentos.length === 0) puntos += 0.4;                   // todo neutro: apuesta segura
  if (acentos.length >= 3) {
    const familias = new Set(acentos.map((c) => Math.round(c.hue / 40)));
    if (familias.size >= 3) puntos -= 1.5;                   // demasiados colores distintos
  }
  // Algo de contraste de luminosidad entre arriba y abajo queda mejor
  if (infos.length >= 2) {
    const dl = Math.abs(infos[0].lab[0] - infos[1].lab[0]);
    if (dl > 20) puntos += 0.3;
  }

  if (estilo === 'formal') {
    puntos -= infos.filter((c) => c.chillon).length * 2.5; // nada de colores chillones
    puntos += infos.filter((c) => c.neutro).length * 0.2;
  }
  if (estilo === 'arreglado') {
    if (prendas.some((p) => tiene(p, 'formal'))) puntos += 1;
    puntos -= prendas.filter((p) => ['sudadera', 'shorts', 'chandal'].includes(p.categoria)).length * 1.5;
    puntos -= infos.filter((c) => c.chillon).length * 0.8;
  }
  return { puntos, infos };
}

/* ---------- Frase explicativa ---------- */

function lista(nombres) {
  if (nombres.length <= 1) return nombres[0] || '';
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

function explicar(infos) {
  const neutros = infos.filter((c) => c.neutro);
  const acentos = infos.filter((c) => !c.neutro);
  const nombresNeutros = [...new Set(neutros.map((c) => c.nombre))];
  const nombresAcento = [...new Set(acentos.map((c) => c.nombre))];

  if (!acentos.length) {
    if (nombresNeutros.length === 1) return `look monocromático en ${nombresNeutros[0]}`;
    return `todo en neutros (${lista(nombresNeutros.slice(0, 4))}): elegante y seguro`;
  }
  if (nombresAcento.length === 1) {
    return neutros.length
      ? `base neutra con acento ${nombresAcento[0]}`
      : `look monocromático en ${nombresAcento[0]}`;
  }
  // Dos o más colores: buscar la relación entre los dos principales
  const [a, b] = acentos.filter((c, i, arr) => arr.findIndex((x) => x.nombre === c.nombre) === i);
  const d = difTono(a.hue, b.hue);
  const base = neutros.length ? ' sobre base neutra' : '';
  if (d < 30) return `tonos análogos: ${a.nombre} y ${b.nombre}${base}`;
  if (d >= 150) return `contraste complementario entre ${a.nombre} y ${b.nombre}${base}`;
  if (!a.saturado || !b.saturado) return `${a.nombre} y ${b.nombre} suavizados${base}`;
  return `mezcla atrevida de ${a.nombre} y ${b.nombre}`;
}

/* ---------- Generación ---------- */

export function generarOutfit(todas, estilo, { incluirAbrigo = false, evitar = null } = {}) {
  const def = ESTILOS_OUTFIT[estilo];
  const validas = todas.filter((p) => categoria(p.categoria) && p.color && def.acepta(p));
  const por = { arriba: [], abajo: [], vestido: [], calzado: [], abrigo: [], complemento: [] };
  validas.forEach((p) => por[categoria(p.categoria).slot].push(p));

  const bases = [];
  por.arriba.forEach((t) => por.abajo.forEach((b) => bases.push([t, b])));
  por.vestido.forEach((v) => bases.push([v]));

  const faltan = [];
  if (!bases.length) faltan.push('parte de arriba y de abajo (o un vestido)');
  if (!por.calzado.length) faltan.push('calzado');
  if (faltan.length) {
    return { error: `Para el estilo ${def.nombre} te falta: ${faltan.join(' y ')}. Revisa las etiquetas de estilo de tus prendas o añade más.` };
  }

  const capas = incluirAbrigo && por.abrigo.length ? por.abrigo : [null];
  const aviso = incluirAbrigo && !por.abrigo.length ? `No tienes abrigos ni chaquetas para el estilo ${def.nombre}.` : '';

  const construir = (base, zap, capa) => (capa ? [...base, zap, capa] : [...base, zap]);
  const total = bases.length * por.calzado.length * capas.length;
  const combos = [];
  if (total <= MAX_COMBINACIONES) {
    for (const b of bases) for (const z of por.calzado) for (const c of capas) combos.push(construir(b, z, c));
  } else {
    // Demasiadas: muestra aleatoria
    for (let i = 0; i < MAX_COMBINACIONES; i++) combos.push(construir(aleatorio(bases), aleatorio(por.calzado), aleatorio(capas)));
  }

  const puntuados = combos.map((prendas) => ({ prendas, ...puntuar(prendas, estilo) }));
  puntuados.sort((a, b) => b.puntos - a.puntos);

  // Elegir al azar entre los mejores (para que "Otro" dé variedad)
  const mejor = puntuados[0].puntos;
  const topN = Math.min(25, Math.max(5, Math.ceil(puntuados.length * 0.05)));
  let candidatos = puntuados.slice(0, topN).filter((o, i) => i < 3 || o.puntos >= mejor - 1);
  // Quitar duplicados (por la muestra aleatoria) y el outfit anterior
  const vistos = new Set();
  candidatos = candidatos.filter((o) => {
    const k = claveOutfit(o.prendas.map((p) => p.id));
    if (vistos.has(k)) return false;
    vistos.add(k); o.clave = k; return true;
  });
  if (evitar && candidatos.length > 1) candidatos = candidatos.filter((o) => o.clave !== evitar);

  const elegido = aleatorio(candidatos);
  const prendas = [...elegido.prendas].sort((a, b) => ORDEN_SLOT[categoria(a.categoria).slot] - ORDEN_SLOT[categoria(b.categoria).slot]);
  return {
    prendas,
    clave: elegido.clave,
    estilo,
    frase: explicar(elegido.infos),
    puntos: elegido.puntos,
    aviso,
  };
}
