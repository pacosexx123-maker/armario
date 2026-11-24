"""Genera las máscaras de botones y cremalleras de las fotos de producto del catálogo.

Uso (una sola vez, desde la carpeta del proyecto):
    python tools/mascaras.py

Para cada assets/catalogo/<id>.png crea assets/catalogo/mascaras/<id>.png (blanco = botón o
cremallera, negro = resto) y un índice assets/catalogo/mascaras/indice.json con lo encontrado.

Cómo distingue botones y cremalleras de sombras y pliegues oscuros:
  - Solo cuenta píxeles muy oscuros DENTRO de la silueta (canal alfa opaco).
  - Botón: mancha pequeña, compacta y redondeada (relleno de su caja >= 55 %, proporción
    entre 1:2 y 2:1), de entre el 1,2 % y el 6 % del ancho de la prenda, en la franja central
    y sin tocar el borde de la silueta.
  - Cremallera: tira vertical alargada en la línea central (más del 5 % de la altura); las
    manchas oscuras pegadas a ella (el tirador) se añaden a la cremallera.
  - Las sombras de axilas, costados y pliegues son alargadas, están a los lados o tocan el
    borde de la silueta, así que se descartan.
  - Al final se añade el halo suavizado alrededor de cada botón para teñirlo entero.
"""
import json
import os
from collections import deque

from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'catalogo')
SALIDA = os.path.join(RAIZ, 'mascaras')
OSCURO = 70        # luminosidad (0–255) por debajo de la cual un píxel es «muy oscuro»
HALO = 125         # píxeles algo menos oscuros pegados a un botón (borde suavizado)


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def procesar(ruta):
    im = Image.open(ruta).convert('RGBA')
    W, H = im.size
    px = im.load()
    opaco = [[px[x, y][3] > 200 for x in range(W)] for y in range(H)]
    L = [[lum(px[x, y]) for x in range(W)] for y in range(H)]
    xs = [x for y in range(H) for x in range(W) if opaco[y][x]]
    ys = [y for y in range(H) for x in range(W) if opaco[y][x]]
    bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
    bw, bh = bx1 - bx0 + 1, by1 - by0 + 1

    def borde_cerca(x, y, r=3):
        for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r)):
            a, b = x + dx, y + dy
            if not (0 <= a < W and 0 <= b < H) or not opaco[b][a]:
                return True
        return False

    # Componentes conexas de píxeles muy oscuros dentro de la silueta
    visto = [[False] * W for _ in range(H)]
    comps = []
    for y in range(H):
        for x in range(W):
            if visto[y][x] or not opaco[y][x] or L[y][x] >= OSCURO:
                continue
            q = deque([(x, y)])
            visto[y][x] = True
            pts = []
            while q:
                a, b = q.popleft()
                pts.append((a, b))
                for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c < W and 0 <= d < H and not visto[d][c] and opaco[d][c] and L[d][c] < OSCURO:
                        visto[d][c] = True
                        q.append((c, d))
            X = [p[0] for p in pts]
            Y = [p[1] for p in pts]
            w, h = max(X) - min(X) + 1, max(Y) - min(Y) + 1
            comps.append({
                'pts': pts, 'n': len(pts), 'w': w, 'h': h,
                'x0': min(X), 'x1': max(X), 'y0': min(Y), 'y1': max(Y),
                'cx': (sum(X) / len(X) - bx0) / bw, 'cy': (sum(Y) / len(Y) - by0) / bh,
                'relleno': len(pts) / (w * h), 'wrel': w / bw, 'hrel': h / bh,
                'borde': any(borde_cerca(a, b) for a, b in pts[:: max(1, len(pts) // 25)]),
            })

    min_area = max(6, (0.006 * bw) ** 2)
    botones, cremallera = [], []
    for c in comps:
        if c['n'] < min_area:
            continue
        compacto = c['relleno'] >= 0.55 and 0.5 <= c['w'] / c['h'] <= 2.0
        if compacto and 0.012 <= c['wrel'] <= 0.06 and 0.28 <= c['cx'] <= 0.72 and not c['borde']:
            botones.append(c)
        elif c['h'] > c['w'] * 2.5 and c['hrel'] >= 0.05 and 0.42 <= c['cx'] <= 0.58 and not c['borde']:
            cremallera.append(c)

    # Tirador y piezas sueltas de la cremallera: manchas oscuras pegadas a ella
    if cremallera:
        mx = 0.06 * bw
        zx0 = min(c['x0'] for c in cremallera) - mx
        zx1 = max(c['x1'] for c in cremallera) + mx
        zy0 = min(c['y0'] for c in cremallera) - mx
        zy1 = max(c['y1'] for c in cremallera) + mx
        for c in comps:
            if c in cremallera or c in botones or c['n'] < 4 or c['borde']:
                continue
            if c['x0'] >= zx0 and c['x1'] <= zx1 and c['y0'] >= zy0 and c['y1'] <= zy1:
                cremallera.append(c)

    # Máscara + halo suavizado alrededor (crecimiento hacia píxeles algo oscuros)
    m = [[0] * W for _ in range(H)]
    q = deque()
    for c in botones + cremallera:
        for a, b in c['pts']:
            m[b][a] = 255
            q.append((a, b, 0))
    while q:
        a, b, d = q.popleft()
        if d >= 3:
            continue
        for c2, d2 in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
            if 0 <= c2 < W and 0 <= d2 < H and not m[d2][c2] and opaco[d2][c2] and L[d2][c2] < HALO:
                m[d2][c2] = 255
                q.append((c2, d2, d + 1))

    mascara = Image.new('L', (W, H), 0)
    mascara.putdata([m[y][x] for y in range(H) for x in range(W)])
    return mascara, {'botones': len(botones), 'cremallera': bool(cremallera),
                     'pixeles': sum(1 for y in range(H) for x in range(W) if m[y][x])}


def main():
    os.makedirs(SALIDA, exist_ok=True)
    indice = {}
    for f in sorted(os.listdir(RAIZ)):
        if not f.endswith('.png'):
            continue
        ident = f[:-4]
        mascara, info = procesar(os.path.join(RAIZ, f))
        mascara.save(os.path.join(SALIDA, f), optimize=True)
        indice[ident] = info
        que = []
        if info['botones']:
            que.append(f"{info['botones']} " + ('botones' if info['botones'] > 1 else 'botón'))
        if info['cremallera']:
            que.append('cremallera')
        print(f"{ident:20} {', '.join(que) or 'vacía (sin botones ni cremallera)'}")
    with open(os.path.join(SALIDA, 'indice.json'), 'w', encoding='utf-8') as fh:
        json.dump(indice, fh, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
