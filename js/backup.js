// Copia de seguridad: exportar / importar todo el armario (con fotos) en JSON.

import * as db from './db.js';
import { blobToDataURL, dataURLToBlob } from './image.js';

const FORMATO = 'armario-backup';

export async function exportar() {
  const [prendas, outfits] = await Promise.all([db.getAll('prendas'), db.getAll('outfits')]);
  const prendasJSON = [];
  for (const p of prendas) {
    const { foto, ...resto } = p;
    prendasJSON.push({ ...resto, foto: foto ? await blobToDataURL(foto) : null });
  }
  const datos = {
    formato: FORMATO,
    version: 1,
    exportado: new Date().toISOString(),
    prendas: prendasJSON,
    outfits,
  };
  const blob = new Blob([JSON.stringify(datos)], { type: 'application/json' });
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `armario-${fecha}.json`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return { prendas: prendas.length, outfits: outfits.length, nombre };
}

// Combina la copia con lo que ya hay (las prendas con el mismo id se sobrescriben).
export async function importar(file) {
  let datos;
  try { datos = JSON.parse(await file.text()); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (!datos || datos.formato !== FORMATO || !Array.isArray(datos.prendas)) {
    throw new Error('Este archivo no es una copia de Armario.');
  }
  const prendas = datos.prendas
    .filter((p) => p && p.id && p.foto)
    .map(({ foto, ...resto }) => ({ ...resto, foto: dataURLToBlob(foto) }));
  const outfits = (datos.outfits || []).filter((o) => o && o.id && Array.isArray(o.ids));
  await db.putMany('prendas', prendas);
  await db.putMany('outfits', outfits);
  return { prendas: prendas.length, outfits: outfits.length };
}
