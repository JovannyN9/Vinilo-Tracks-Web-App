"""
Vinilo Tracks — versiones ligeras de las imágenes (para que cargue rápido sin perder calidad)

Qué hace:
  Por cada imagen de public/img crea copias .webp más chicas en public/img/r/
  (480, 960 y 1600 px de ancho, solo si la original es más grande).
  La ORIGINAL NO SE TOCA: las pantallas grandes la siguen usando completa.
  El servidor elige solo la versión adecuada para cada pantalla (srcset).

Cuándo correrlo: cada vez que agregues imágenes nuevas.
  pip install pillow        (solo la primera vez)
  python3 scripts/imagenes.py
"""
import json, os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, "public", "img")
SALIDA = os.path.join(IMG, "r")
ANCHOS = [480, 960, 1600]
SALTAR = {"logo-email.jpg"}            # la del correo no se toca
os.makedirs(SALIDA, exist_ok=True)

manifiesto = {}
for nombre in sorted(os.listdir(IMG)):
    ruta = os.path.join(IMG, nombre)
    base, ext = os.path.splitext(nombre)
    if nombre in SALTAR or not os.path.isfile(ruta) or ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        continue
    im = Image.open(ruta)
    w, h = im.size
    versiones = []
    for ancho in ANCHOS:
        if ancho >= w * 0.9:           # si casi es del mismo tamaño, no vale la pena
            continue
        destino = os.path.join(SALIDA, f"{base}-{ancho}.webp")
        if not os.path.exists(destino) or os.path.getmtime(destino) < os.path.getmtime(ruta):
            copia = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
            copia = copia.resize((ancho, round(h * ancho / w)), Image.LANCZOS)
            copia.save(destino, "WEBP", quality=88, method=6)
        versiones.append(ancho)
    manifiesto[f"/img/{nombre}"] = {"w": w, "h": h, "v": versiones}
    print(f"✓ {nombre:28} {w}×{h}  → {versiones or 'ya es chica, se usa tal cual'}")

with open(os.path.join(RAIZ, "data", "imagenes.json"), "w", encoding="utf-8") as f:
    json.dump(manifiesto, f, ensure_ascii=False, indent=1)
print(f"\nListo: {len(manifiesto)} imágenes en data/imagenes.json")
