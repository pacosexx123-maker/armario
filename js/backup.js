// Copia de seguridad: exportar / importar todo el armario (con fotos) en JSON.

import * as db from './db.js';
import { blobToDataURL, dataURLToBlob } from './image.js';

const FORMATO = 'armario-backup';

async function conFotoEnTexto(items) {
  const res = [];
  for (const it of items) {
    const { foto, ...resto } = it;
    res.push({ ...resto, foto: foto ? await blobToDataURL(foto) : null });
  }
  return res;
}

export async function exportar() {
  const [prendas, outfits, looks] = await Promise.all([db.getAll('prendas'), db.getAll('outfits'), db.getAll('looks')]);
  const datos = {
    formato: FORMATO,
    version: 2,
    exportado: new Date().toISOString(),
    prendas: await conFotoEnTexto(prendas),
    outfits,
    looks: await conFotoEnTexto(looks),
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
  return { prendas: prendas.length, outfits: outfits.length, looks: looks.length, nombre };
}

// Combina la copia con lo que ya hay (lo que tenga el mismo id se sobrescribe).
export async function importar(file) {
  let datos;
  try { datos = JSON.parse(await file.text()); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (!datos || datos.formato !== FORMATO || !Array.isArray(datos.prendas)) {
    throw new Error('Este archivo no es una copia de Armario.');
  }
  // Las prendas sin foto (básicos) también se importan
  const prendas = datos.prendas
    .filter((p) => p && p.id && (p.foto || p.basico))
    .map(({ foto, ...resto }) => ({ ...resto, foto: foto ? dataURLToBlob(foto) : null }));
  const outfits = (datos.outfits || []).filter((o) => o && o.id && Array.isArray(o.ids));
  const looks = (datos.looks || [])
    .filter((l) => l && l.id && Array.isArray(l.huecos))
    .map(({ foto, ...resto }) => ({ ...resto, foto: foto ? dataURLToBlob(foto) : null }));
  await db.putMany('prendas', prendas);
  await db.putMany('outfits', outfits);
  await db.putMany('looks', looks);
  return { prendas: prendas.length, outfits: outfits.length, looks: looks.length };
}
