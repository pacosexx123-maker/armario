// Navegación con la History API para que el botón «atrás» de Android se comporte como en
// una app nativa: cada pestaña, pantalla, paso y ventana añade una entrada al historial y
// «atrás» cierra solo lo último que se abrió.
//
// La pila refleja lo que está abierto, de abajo arriba:
//   { tipo: 'tab', tab }                              → cambio de pestaña
//   { tipo: 'capa', cerrar(), antesDeCerrar() }       → pantalla, paso o ventana
// Cada entrada de la pila corresponde a una entrada del historial del navegador.

const pila = [];
const SESION = Math.random().toString(36).slice(2);
let mostrarTab = () => {};
let indice = 0;            // posición actual en el historial (según nuestras entradas)
const ops = [];            // operaciones de historial pendientes (se hacen de una en una)
let esperando = null;      // operación que espera su evento popstate

/* ---------- Cola de operaciones sobre el historial ---------- */

function encolar(op) {
  const ultima = ops[ops.length - 1];
  if (op.tipo === 'atras' && ultima && ultima.tipo === 'atras' && op.silencioso && ultima.silencioso) ultima.n += op.n;
  else ops.push(op);
  ejecutar();
}

function ejecutar() {
  while (ops.length && !esperando) {
    const op = ops.shift();
    if (op.tipo === 'push') {
      indice += 1;
      history.pushState({ armario: indice, sesion: SESION }, '', op.hash ? `#${op.hash}` : location.href);
    } else {
      // atrás silencioso (lo cerramos nosotros) o atrás «de usuario» (pasa por antesDeCerrar)
      esperando = op;
      op.temporizador = setTimeout(() => { if (esperando === op) { esperando = null; ejecutar(); } }, 800);
      history.go(-op.n);
    }
  }
}

/* ---------- Atrás ---------- */

function deshacer(entrada) {
  if (entrada.tipo === 'tab') mostrarTab(tabActual());
  else if (entrada.cerrar) entrada.cerrar();
}

function alVolver(e) {
  const st = e.state;
  // Entradas de una sesión anterior (la página se recargó): se saltan
  if (!st || st.sesion !== SESION) {
    if (st && st.sesion && st.sesion !== SESION) { history.back(); }
    return;
  }
  const op = esperando;
  if (op) { clearTimeout(op.temporizador); esperando = null; }
  indice = st.armario;
  if (op && op.silencioso) { ejecutar(); return; }

  // Atrás del usuario: cerrar lo que haya por encima del destino
  while (pila.length - 1 > indice) {
    const arriba = pila[pila.length - 1];
    if (arriba.antesDeCerrar && !arriba.antesDeCerrar()) {
      // Se cancela: se vuelven a poner las entradas del historial que se han quitado
      const faltan = pila.length - 1 - indice;
      for (let i = 0; i < faltan; i++) encolar({ tipo: 'push' });
      ejecutar();
      return;
    }
    pila.pop();
    deshacer(arriba);
  }
  ejecutar();
}

/* ---------- API ---------- */

export function iniciarNavegacion(tabInicial, fnMostrarTab) {
  mostrarTab = fnMostrarTab;
  pila.length = 0;
  pila.push({ tipo: 'tab', tab: tabInicial });
  indice = 0;
  history.replaceState({ armario: 0, sesion: SESION }, '', `#${tabInicial}`);
  window.addEventListener('popstate', alVolver);
}

export function tabActual() {
  for (let i = pila.length - 1; i >= 0; i--) if (pila[i].tipo === 'tab') return pila[i].tab;
  return 'armario';
}

// Cambiar de pestaña (añade una entrada)
export function irATab(tab) {
  if (tab === tabActual()) return;
  pila.push({ tipo: 'tab', tab });
  encolar({ tipo: 'push', hash: tab });
  mostrarTab(tab);
}

// Abrir una pantalla, paso o ventana. cerrar() la cierra sin preguntar; antesDeCerrar()
// devuelve false para no cerrar (p. ej. «¿Descartar cambios?» → Cancelar).
export function abrirCapa({ cerrar = null, antesDeCerrar = null } = {}) {
  const capa = { tipo: 'capa', cerrar, antesDeCerrar };
  pila.push(capa);
  encolar({ tipo: 'push' });
  return capa;
}

export const capaAbierta = (capa) => pila.includes(capa);

// La interfaz ha cerrado la capa por su cuenta (Guardar, X…): se quita del historial
export function cerrarCapa(capa) {
  const i = pila.indexOf(capa);
  if (i < 0) return;
  const quitadas = pila.splice(i);
  quitadas.slice(1).reverse().forEach(deshacer); // lo que hubiera encima también se cierra
  encolar({ tipo: 'atras', n: quitadas.length, silencioso: true });
}

// Cerrar una capa concreta desde su propio botón (X, Cancelar, tocar fuera): pregunta si hay
// cambios y cierra también lo que tenga abierto encima (p. ej. una paleta dentro de la ventana)
export function cerrarConPregunta(capa) {
  if (!capa || !capaAbierta(capa)) return;
  if (capa.antesDeCerrar && !capa.antesDeCerrar()) return;
  cerrarCapa(capa);
  if (capa.cerrar) capa.cerrar();
}

// Igual que pulsar «atrás» (pregunta si hay cambios sin guardar)
export function atras() {
  if (pila.length <= 1) return;
  encolar({ tipo: 'atras', n: 1, silencioso: false });
}

// Cerrar todo y volver a la primera pantalla (p. ej. después de guardar)
export function volverAlInicio() {
  const quitadas = pila.splice(1);
  if (!quitadas.length) return;
  quitadas.reverse().forEach(deshacer);
  encolar({ tipo: 'atras', n: quitadas.length, silencioso: true });
}

// Abrir un <dialog> modal como capa: «atrás» o Escape lo cierran; si se cierra desde
// dentro (dlg.close()), se quita del historial.
export function abrirDialogo(dlg, { antesDeCerrar = null } = {}) {
  if (!dlg.open) dlg.showModal();
  const capa = abrirCapa({ cerrar: () => { if (dlg.open) dlg.close(); }, antesDeCerrar });
  const alCancelar = (e) => { e.preventDefault(); cerrarConPregunta(capa); };
  const alCerrar = () => {
    dlg.removeEventListener('cancel', alCancelar);
    dlg.removeEventListener('close', alCerrar);
    cerrarCapa(capa);
  };
  dlg.addEventListener('cancel', alCancelar);
  dlg.addEventListener('close', alCerrar);
  dlg.capaNav = capa; // para cerrarla desde sus botones con cerrarConPregunta(dlg.capaNav)
  return capa;
}

// Pregunta estándar para salir con cambios sin guardar
export const confirmarDescartar = () => confirm('¿Descartar cambios?');
