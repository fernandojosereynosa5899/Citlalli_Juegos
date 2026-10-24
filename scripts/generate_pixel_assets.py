#!/usr/bin/env python3
"""
CITLALLI ("El Aroma de los Dioses") - Generador de Activos Oficiales y Pixel Art
Extrae los activos de marca desde los documentos .docx oficiales y genera una
coleccion completa y permanente de sprites Pixel Art (PNG + SVG), hoja de sprites
(spritesheet), fondos de escenarios panoramicos (640x360) y manifiesto JSON.
"""

import json
import math
import os
import shutil
import struct
import zipfile
import zlib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND_DIR = os.path.join(BASE_DIR, "public", "assets", "brand")
PIXEL_DIR = os.path.join(BASE_DIR, "public", "assets", "pixel-art")
SPRITES_DIR = os.path.join(PIXEL_DIR, "sprites")
SCENARIOS_DIR = os.path.join(PIXEL_DIR, "scenarios")


def ensure_dirs():
    for d in [BRAND_DIR, PIXEL_DIR, SPRITES_DIR, SCENARIOS_DIR]:
        os.makedirs(d, exist_ok=True)


def hex_to_rgba(hex_str):
    if not hex_str or hex_str == ".":
        return (0, 0, 0, 0)
    h = hex_str.lstrip("#")
    if len(h) == 6:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    elif len(h) == 8:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    return (0, 0, 0, 0)


def write_png(filepath, width, height, rgba_pixels):
    """
    Escribe un archivo PNG RGBA valido usando unicamente la libreria estandar (zlib/struct).
    rgba_pixels: lista plana o bytes de longitud width * height * 4, o lista de filas.
    """
    raw_data = bytearray()
    if isinstance(rgba_pixels, (bytes, bytearray)):
        stride = width * 4
        for y in range(height):
            raw_data.append(0)  # Filter type 0 (None)
            raw_data.extend(rgba_pixels[y * stride : (y + 1) * stride])
    else:
        for y in range(height):
            raw_data.append(0)
            row = rgba_pixels[y]
            for r, g, b, a in row:
                raw_data.extend((r, g, b, a))

    def make_chunk(chunk_type, data):
        chunk = struct.pack(">I", len(data)) + chunk_type + data
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return chunk + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw_data), level=9)

    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        + make_chunk(b"IHDR", ihdr)
        + make_chunk(b"IDAT", compressed)
        + make_chunk(b"IEND", b"")
    )
    with open(filepath, "wb") as f:
        f.write(png_bytes)


def grid_to_scaled_rgba(grid, palette, scale=4):
    """Convierte una matriz de caracteres (grid) en pixeles RGBA escalados nearest-neighbor."""
    h = len(grid)
    w = len(grid[0]) if h > 0 else 0
    out_w, out_h = w * scale, h * scale
    rows = []
    for y in range(h):
        row_colors = [hex_to_rgba(palette.get(ch, None)) for ch in grid[y]]
        scaled_row = []
        for c in row_colors:
            scaled_row.extend([c] * scale)
        for _ in range(scale):
            rows.append(list(scaled_row))
    return out_w, out_h, rows


def grid_to_svg(grid, palette, scale=4):
    """Genera un SVG crispEdges a partir de una matriz de caracteres."""
    h = len(grid)
    w = len(grid[0]) if h > 0 else 0
    out_w, out_h = w * scale, h * scale
    rects = []
    for y, line in enumerate(grid):
        for x, ch in enumerate(line):
            col = palette.get(ch)
            if col and col != ".":
                rects.append(
                    f'  <rect x="{x * scale}" y="{y * scale}" width="{scale}" height="{scale}" fill="{col}"/>'
                )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {out_w} {out_h}" '
        f'width="{out_w}" height="{out_h}" shape-rendering="crispEdges">\n'
        + "\n".join(rects)
        + "\n</svg>\n"
    )
    return svg


def extract_brand_assets():
    """Extrae las imagenes oficiales de los .docx y copia la captura estelar."""
    extractions = [
        ("Boceto_Producto.docx", "word/media/image3.png", "bottle.png"),
        ("Boceto_Producto.docx", "word/media/image4.png", "box.png"),
        ("Boceto_Producto.docx", "word/media/image5.png", "logo.png"),
        ("Boceto_Producto.docx", "word/media/image6.png", "moodboard.png"),
        ("Boceto_Producto.docx", "word/media/image7.png", "notes_velvet_1.png"),
        ("Boceto_Producto.docx", "word/media/image8.png", "label_back.png"),
        ("Boceto_Producto.docx", "word/media/image9.png", "notes_velvet_2.png"),
        ("Boceto_Producto.docx", "word/media/image10.png", "instructions_card.png"),
        ("Publicidad_Perfume.docx", "word/media/image3.jpeg", "ad_poster_luxury.jpeg"),
        ("Publicidad_Perfume.docx", "word/media/image4.png", "ad_poster_jaguar.png"),
        ("Publicidad_Perfume.docx", "word/media/image5.gif", "ad_promo.gif"),
        ("Storytelling.docx", "word/media/image3.jpeg", "storytelling_david.jpeg"),
    ]

    extracted_files = []
    for docx_name, media_path, out_name in extractions:
        docx_full = os.path.join(BASE_DIR, docx_name)
        out_full = os.path.join(BRAND_DIR, out_name)
        if os.path.exists(docx_full):
            with zipfile.ZipFile(docx_full, "r") as zf:
                if media_path in zf.namelist():
                    with zf.open(media_path) as src, open(out_full, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    extracted_files.append(f"/assets/brand/{out_name}")

    screenshot_src = os.path.join(BASE_DIR, "Captura de pantalla 2026-10-19 083149.png")
    screenshot_dst = os.path.join(BRAND_DIR, "emblem_cosmic.png")
    if os.path.exists(screenshot_src):
        shutil.copy2(screenshot_src, screenshot_dst)
        extracted_files.append("/assets/brand/emblem_cosmic.png")

    return extracted_files


# ============================================================================
# PALETA MAESTRA Y DEFINICION DE SPRITES PIXEL ART (16x16)
# ============================================================================
PALETTE = {
    ".": None,
    # Dorados y Oro Rosa
    "G": "#D4AF37",  # Gold clasico
    "Y": "#FFE885",  # Gold brillante / luz
    "D": "#997A15",  # Gold oscuro / sombra
    "R": "#E8A598",  # Rose gold
    "r": "#B86B5E",  # Rose gold sombra
    "P": "#FFD1DC",  # Rosa luz / brillo
    # Azules Nocturnos y Cristal
    "N": "#0B1528",  # Azul medianoche profundo
    "B": "#162A4A",  # Azul terciopelo
    "C": "#64B5F6",  # Cristal celeste
    "L": "#B3E5FC",  # Brillo cristal claro
    "W": "#FFFFFF",  # Blanco puro
    # Notas Olfativas y Naturaleza
    "O": "#FF9800",  # Mandarina / Ambar
    "o": "#E65100",  # Mandarina sombra / Canela
    "M": "#FFCC80",  # Pulpa mandarina / Ambar claro
    "K": "#E91E63",  # Rosa intensa
    "k": "#AD1457",  # Rosa sombra
    "F": "#F48FB1",  # Rosa petalo suave
    "E": "#4CAF50",  # Hoja verde
    "e": "#2E7D32",  # Hoja verde oscuro
    "V": "#5D4037",  # Vainilla oscura
    "v": "#8D6E63",  # Canela / Barro claro
    "T": "#A14A2A",  # Barro terracota Hidalgo
    "t": "#6D2C15",  # Barro sombra
    # Obstaculos / Humo / Sombras
    "S": "#37474F",  # Humo gris oscuro
    "s": "#263238",  # Humo negro
    "A": "#78909C",  # Humo borde claro
    "X": "#FF5252",  # Ojo / destello carmesi
}

SPRITE_GRIDS = {
    # 1. Frasco facetado Citlalli con tapa oro rosa y dije QM
    "bottle_citlalli": [
        ".....RRRRRR.....",
        "....RPRRRRRr....",
        "....RRRRRRRR....",
        ".....rRRRRr.....",
        "......GGGGYY....",
        "....CCLLLLCCYY..",
        "...CWLCCCCLCC...",
        "..CWLLCCCCLLCC..",
        "..CWLGGYYGGLCC..",
        "..CWLGYWWYGLCC..",
        "..CWLGGYYGGLCC..",
        "..CCLLCCCCLLCC..",
        "..CCCLLLLLLCCC..",
        "...CCCCCCCCCC...",
        "....DDDDDDDD....",
        "....GGGGGGGG....",
    ],
    # 2. Frasco Citlalli con alas doradas (Flappy)
    "bottle_winged": [
        ".....RRRRRR.....",
        ".YY..RPRRRr..YY.",
        "YYYY..RRRR..YYYY",
        "YYGGY.GGGG.YGGYY",
        ".YGGGCCCCCCGGGY.",
        "..GGCWLLCCCCGG..",
        ".YYGCWLGGYGLCYY.",
        "YYYGCWLGYWYGLYYY",
        ".GGDCWLGGYGLCDG.",
        "..D.CCLLLLCC.D..",
        ".....CCCCCC.....",
        "....DDDDDDDD....",
        "....GGGGGGGG....",
        "................",
        "................",
        "................",
    ],
    # 3. Dije / Medallon redondo dorado QM
    "charm_qm": [
        "......GGGG......",
        "....GGYYYYGG....",
        "...GYYDDDDYYG...",
        "..GYDDNNNNDDYG..",
        ".GYDNNYYYYNNDYG.",
        ".GYDNYN..NYNDYG.",
        "GYDNYN.YY.NYNDYG",
        "GYDNYN.YY.NYNDYG",
        "GYDNYN..Y.NYNDYG",
        "GYDNNYYYYYYNNDYG",
        ".GYDNN....NNDYG.",
        ".GYDDNNNNNNDDYG.",
        "..GYDDGGGGDDYG..",
        "...GYYGGGGYYG...",
        "....GGDDDDGG....",
        "......DDDD......",
    ],
    # 4. Jaguar Prehispanico Dorado
    "jaguar_gold": [
        "..GG........GG..",
        ".GYYG......GYYG.",
        ".GYDG.GGGG.GDYG.",
        "..GGGGYYYYGGGG..",
        "..GYYDYYYYDYYG..",
        ".GYYGGGGGGGGYYG.",
        ".GYGXXGGGGXXGYG.",
        "GYGGXXGYYGXXGGYG",
        "GYGGGGGGGGGGGGYG",
        "GYYGDDDDDDDDGYYG",
        ".GYGDWWGGWWDFYG.",
        ".GYYDGGGGGGDYYG.",
        "..GYYDDDDDDYYG..",
        "...GGYYYYYYGG...",
        "....DDDDDDDD....",
        "................",
    ],
    # 5. Estrella Celeste Citlalli de 8 puntas
    "star_citlalli": [
        ".......YY.......",
        ".......YY.......",
        "..Y....GG....Y..",
        "...Y..GYYG..Y...",
        "....YGYYYYGY....",
        ".....GYYYYG.....",
        "....GYYWWYYG....",
        "YYGGGYYWWYYGGGYY",
        "YYGGGYYWWYYGGGYY",
        "....GYYWWYYG....",
        ".....GYYYYG.....",
        "....YGYYYYGY....",
        "...Y..GYYG..Y...",
        "..Y....GG....Y..",
        ".......YY.......",
        ".......YY.......",
    ],
    # 6. Mandarina Chispeante (Nota de Salida)
    "mandarin": [
        ".......EE.......",
        "......EEEE......",
        "....OOOOOOOO....",
        "..OOOMMMMMMOOO..",
        ".OOMMWOMMMOWMMO.",
        ".OMMWOOOMOOOWMO.",
        "OOMOOOOOMOOOOOMO",
        "OMWWWWWWWWWWWWMO",
        "OOMOOOOOMOOOOOMO",
        ".OMMWOOOMOOOWMO.",
        ".OOMMWOMMMOWMMO.",
        "..OOOMMMMMMOOO..",
        "...oooooooooo...",
        ".....oooooo.....",
        "................",
        "................",
    ],
    # 7. Rosa Rosada (Nota de Corazon)
    "rose_pink": [
        ".....FFFFFF.....",
        "...FFKKKKKKFF...",
        "..FKKFFFFFFKKF..",
        ".FKKFFKKKKFFKKF.",
        ".FKFFKKkkkkFFKF.",
        "FKFFKkkFFFFkkFKF",
        "FKFKkkFFKKFFkFKF",
        "FKKkkFFKkkKFFKKF",
        ".FKKFFKKKKKKFKK.",
        ".FkkkkKKKKKKkkF.",
        "..EEkkkkkkkkEE..",
        "...EEEEkkEEEE...",
        ".....eeEEee.....",
        ".......EE.......",
        ".......ee.......",
        "......ee........",
    ],
    # 8. Flor Blanca de Jazmin (Nota de Corazon)
    "jasmine_white": [
        "......WWWW......",
        ".....WWWWWW.....",
        ".....WWLLWW.....",
        ".WWWW..LL..WWWW.",
        "WWWWWW.YY.WWWWWW",
        "WWLLWWGYYGWWLLWW",
        ".WWWW.YYYY.WWWW.",
        ".....GYYYYG.....",
        "..WWWW.YY.WWWW..",
        ".WWWWWW..WWWWWW.",
        ".WWLLWW..WWLLWW.",
        "..WWWW.EE.WWWW..",
        ".......EE.......",
        "......EEEE......",
        ".......ee.......",
        "................",
    ],
    # 9. Vaina de Vainilla y Canela (Nota de Fondo)
    "vanilla_pod": [
        "............VV..",
        "...........VVV..",
        "...oooo...VVvV..",
        "..ooMMoo.VVvV...",
        "..oMvvMoVVvV....",
        "...ooooVVvV.....",
        "....ooVVvVoo....",
        ".....VVvVoooo...",
        "....VVvV.ooMMo..",
        "...VVvV..oMvvMo.",
        "..VVvV....oooo..",
        ".VVvV......YY...",
        ".VVV............",
        ".VV.............",
        "................",
        "................",
    ],
    # 10. Cristal de Resina de Ambar Dorado (Nota de Fondo)
    "amber_crystal": [
        ".......YY.......",
        "......YYYY......",
        ".....YYMMYY.....",
        "....YYMMMMYY....",
        "...YYMMWWMMYY...",
        "..OOMMWWWWMMOO..",
        "..OOMMMWWMMMOO..",
        ".OOOMMMMMMMMOOO.",
        ".OOOOMMMMMMOOOO.",
        "..OOOOMMMMOOOO..",
        "..ooooOOOOoooo..",
        "...ooooOOoooo...",
        "....oooooooo....",
        ".....oooooo.....",
        "......oooo......",
        "................",
    ],
    # 11. Vasija de Barro Artesanal de David (Hidalgo)
    "clay_vessel": [
        "....TTTTTTTT....",
        "...TvvvvvvvvT...",
        "....TTTTTTTT....",
        ".....TttttT.....",
        "...TTTGGGGTTT...",
        "..TTvvvvvvvvTT..",
        ".TTvTTTTTTTTvTT.",
        ".TTGGGGYYGGGGTT.",
        ".TTvTTTTTTTTvTT.",
        ".TTvvvvvvvvvvTT.",
        "..TTTTTTTTTTTT..",
        "..TTttttttttTT..",
        "...TTTttttTTT...",
        "....TTTTTTTT....",
        ".....tttttt.....",
        "................",
    ],
    # 12. Cabeza de Serpiente Emplumada Dorada (Quetzalcoatl / Citlalli)
    "snake_head_gold": [
        ".YY..........YY.",
        "YYYY..GGGG..YYYY",
        ".YYGGYYYYYYGGYY.",
        "..GGYYYYYYYYGG..",
        ".GYYYYDDDDYYYYG.",
        ".GYYGGGGGGGGYYG.",
        "GYYGLLGGGGLLGYYG",
        "GYYGLLGGGGLLGYYG",
        "GYYGGGGGGGGGGYYG",
        ".GYYYYGGGGYYYYG.",
        ".GGYYYYYYYYYYGG.",
        "..GGDDDDDDDDGG..",
        "...GGGGGGGGGG...",
        "......XXXX......",
        ".....XX..XX.....",
        "....XX....XX....",
    ],
    # 13. Cabeza de Serpiente Oro Rosa
    "snake_head_rosegold": [
        ".PP..........PP.",
        "PPPP..RRRR..PPPP",
        ".PPrrRRRRRRrrPP.",
        "..rrRRRRRRRRrr..",
        ".rRRRRrrrrRRRRr.",
        ".rRRPPPPPPPPRRr.",
        "rRRPLLPPPPLLPRRr",
        "rRRPLLPPPPLLPRRr",
        "rRRPPPPPPPPPRRr.",
        ".rRRRRPPPPRRRRr.",
        ".rrRRRRRRRRRRrr.",
        "..rrrrrrrrrrrr..",
        "...RRRRRRRRRR...",
        "......YYYY......",
        ".....YY..YY.....",
        "....YY....YY....",
    ],
    # 14. Nube de Humo Oscuro / Obstaculo
    "smoke_hazard": [
        ".....AAAAAA.....",
        "...AASSSSSSAA...",
        "..ASSSSSSSSSSA..",
        ".ASSSssSSssSSSA.",
        ".ASSssXXXXssSSA.",
        "ASSSsXXssXXsSSSA",
        "ASSSSSSSSSSSSSSA",
        "ASSSssssssssSSSA",
        ".ASssssssssssSA.",
        ".AAssssssssssAA.",
        "..AASSSSSSSSAA..",
        "....AAAAAAAA....",
        ".....ss..ss.....",
        "....ss....ss....",
        "................",
        "................",
    ],
    # 15. Reverso de Carta Terciopelo Azul Marino con Estrella Citlalli
    "card_back_velvet": [
        "GGGGGGGGGGGGGGGG",
        "GNNNNNNNNNNNNNNG",
        "GNBBBBBBBBBBBBNG",
        "GNBGGYYYYYYGGBNG",
        "GNBGYNNNNNNYGBNG",
        "GNBYN..YY..NYBNG",
        "GNBYN..YY..NYBNG",
        "GNBYNYYYYYYNYBNG",
        "GNBYNYYYYYYNYBNG",
        "GNBYN..YY..NYBNG",
        "GNBYN..YY..NYBNG",
        "GNBGYNNNNNNYGBNG",
        "GNBGGYYYYYYGGBNG",
        "GNBBBBBBBBBBBBNG",
        "GNNNNNNNNNNNNNNG",
        "GGGGGGGGGGGGGGGG",
    ],
}


def generate_sprites():
    """Genera todos los sprites PNG (64x64) y SVG mas el spritesheet maestro."""
    sprite_manifest = {}
    sheet_cols = 5
    keys = list(SPRITE_GRIDS.keys())
    sheet_rows = math.ceil(len(keys) / sheet_cols)
    cell_size = 64
    sheet_w = sheet_cols * cell_size
    sheet_h = sheet_rows * cell_size
    sheet_pixels = [[(0, 0, 0, 0) for _ in range(sheet_w)] for _ in range(sheet_h)]

    for idx, name in enumerate(keys):
        grid = SPRITE_GRIDS[name]
        w, h, rgba_rows = grid_to_scaled_rgba(grid, PALETTE, scale=4)
        png_path = os.path.join(SPRITES_DIR, f"{name}.png")
        svg_path = os.path.join(SPRITES_DIR, f"{name}.svg")

        write_png(png_path, w, h, rgba_rows)
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(grid_to_svg(grid, PALETTE, scale=4))

        col_idx = idx % sheet_cols
        row_idx = idx // sheet_cols
        ox = col_idx * cell_size
        oy = row_idx * cell_size
        for y in range(min(h, cell_size)):
            for x in range(min(w, cell_size)):
                sheet_pixels[oy + y][ox + x] = rgba_rows[y][x]

        sprite_manifest[name] = {
            "png": f"/assets/pixel-art/sprites/{name}.png",
            "svg": f"/assets/pixel-art/sprites/{name}.svg",
            "width": w,
            "height": h,
            "sheetX": ox,
            "sheetY": oy,
        }

    # Guardar spritesheet maestro
    sheet_png_path = os.path.join(SPRITES_DIR, "spritesheet_citlalli.png")
    write_png(sheet_png_path, sheet_w, sheet_h, sheet_pixels)

    # Generar SVG del spritesheet maestro
    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {sheet_w} {sheet_h}" '
        f'width="{sheet_w}" height="{sheet_h}" shape-rendering="crispEdges">'
    ]
    for idx, name in enumerate(keys):
        grid = SPRITE_GRIDS[name]
        col_idx = idx % sheet_cols
        row_idx = idx // sheet_cols
        ox = col_idx * cell_size
        oy = row_idx * cell_size
        for y, line in enumerate(grid):
            for x, ch in enumerate(line):
                col = PALETTE.get(ch)
                if col and col != ".":
                    svg_parts.append(
                        f'  <rect x="{ox + x * 4}" y="{oy + y * 4}" width="4" height="4" fill="{col}"/>'
                    )
    svg_parts.append("</svg>\n")
    with open(
        os.path.join(SPRITES_DIR, "spritesheet_citlalli.svg"), "w", encoding="utf-8"
    ) as f:
        f.write("\n".join(svg_parts))

    sprite_manifest["spritesheet_citlalli"] = {
        "png": "/assets/pixel-art/sprites/spritesheet_citlalli.png",
        "svg": "/assets/pixel-art/sprites/spritesheet_citlalli.svg",
        "width": sheet_w,
        "height": sheet_h,
    }
    return sprite_manifest


def lerp_color(c1, c2, t):
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
        255,
    )


def generate_scenarios():
    """
    Genera 4 escenarios panoramicos en Pixel Art (base 160x90 escalada x4 a 640x360)
    para que tengan estetica autentica de consola 16-bit y queden guardados en disco.
    """
    base_w, base_h = 160, 90
    scale = 4
    scenarios_info = {}

    def save_upscaled(name, canvas):
        out_w, out_h = base_w * scale, base_h * scale
        scaled_rows = []
        for y in range(base_h):
            row = []
            for x in range(base_w):
                row.extend([canvas[y][x]] * scale)
            for _ in range(scale):
                scaled_rows.append(list(row))
        out_path = os.path.join(SCENARIOS_DIR, f"scenario_{name}.png")
        write_png(out_path, out_w, out_h, scaled_rows)
        scenarios_info[name] = {
            "png": f"/assets/pixel-art/scenarios/scenario_{name}.png",
            "width": out_w,
            "height": out_h,
        }

    # -------------------------------------------------------------------------
    # 1. ESCENARIO HIDALGO: Noche Estrellada en Hidalgo + Gran Arbol de David
    # -------------------------------------------------------------------------
    c_hidalgo = [[(0, 0, 0, 255) for _ in range(base_w)] for _ in range(base_h)]
    for y in range(base_h):
        t = y / base_h
        col = lerp_color((6, 11, 26), (22, 42, 74), t)
        if (y % 4 == 0) and y > 10:
            col = lerp_color((6, 11, 26), (30, 55, 95), t)
        for x in range(base_w):
            c_hidalgo[y][x] = col

    # Estrellas y Constelacion Citlalli
    for i in range(65):
        sx = (i * 37 + 13) % base_w
        sy = (i * 23 + 7) % 58
        c_hidalgo[sy][sx] = (255, 232, 133, 255) if i % 3 == 0 else (255, 255, 255, 255)
    # Estrella polar Citlalli brillante
    cx, cy = 118, 20
    for d in range(-4, 5):
        if 0 <= cx + d < base_w:
            c_hidalgo[cy][cx + d] = (255, 232, 133, 255)
        if 0 <= cy + d < base_h:
            c_hidalgo[cy + d][cx] = (255, 232, 133, 255)
    c_hidalgo[cy][cx] = (255, 255, 255, 255)

    # Cerros de Hidalgo al fondo
    for x in range(base_w):
        hill_h = int(68 - 8 * math.sin(x * 0.045) - 5 * math.cos(x * 0.09))
        for y in range(hill_h, base_h):
            c_hidalgo[y][x] = (10, 18, 36, 255) if y < 78 else (7, 13, 25, 255)

    # El Gran Arbol ancestral donde David descansaba bajo las estrellas
    tree_x = 38
    for y in range(44, 78):
        half_w = 2 + (y - 44) // 8
        for x in range(tree_x - half_w, tree_x + half_w + 1):
            if 0 <= x < base_w:
                c_hidalgo[y][x] = (28, 18, 14, 255)
    # Copa frondosa iluminada con chispas doradas
    for y in range(22, 50):
        for x in range(12, 66):
            dist = ((x - tree_x) / 24.0) ** 2 + ((y - 36) / 14.0) ** 2
            if dist <= 1.0:
                c_hidalgo[y][x] = (15, 32, 42, 255)
                if (x + y) % 11 == 0:
                    c_hidalgo[y][x] = (212, 175, 55, 255)
    save_upscaled("hidalgo", c_hidalgo)

    # -------------------------------------------------------------------------
    # 2. ESCENARIO JAGUAR: Santuario del Jaguar Dorado
    # -------------------------------------------------------------------------
    c_jaguar = [[(0, 0, 0, 255) for _ in range(base_w)] for _ in range(base_h)]
    for y in range(base_h):
        t = y / base_h
        col = lerp_color((18, 12, 6), (52, 34, 14), t)
        for x in range(base_w):
            c_jaguar[y][x] = col

    # Estrellas de ambar
    for i in range(45):
        sx = (i * 41 + 9) % base_w
        sy = (i * 19 + 5) % 50
        c_jaguar[sy][sx] = (255, 193, 7, 255)

    # Piramide Escalonada Prehispanica
    pyr_cx = 80
    for step in range(6):
        top_y = 32 + step * 8
        bot_y = top_y + 8
        half_w = 14 + step * 9
        for y in range(top_y, min(bot_y, base_h)):
            for x in range(pyr_cx - half_w, pyr_cx + half_w):
                if 0 <= x < base_w:
                    c_jaguar[y][x] = (88, 62, 26, 255) if y > top_y else (212, 175, 55, 255)
        # Escalinata central dorada
        for y in range(top_y, min(bot_y, base_h)):
            for x in range(pyr_cx - 6, pyr_cx + 6):
                c_jaguar[y][x] = (160, 120, 40, 255) if y % 2 == 0 else (110, 80, 25, 255)

    # Grecas doradas en la base
    for x in range(base_w):
        for y in range(78, base_h):
            c_jaguar[y][x] = (28, 20, 10, 255)
        if 80 < base_h:
            c_jaguar[80][x] = (212, 175, 55, 255)
            if (x // 4) % 2 == 0:
                c_jaguar[82][x] = (212, 175, 55, 255)
    save_upscaled("jaguar", c_jaguar)

    # -------------------------------------------------------------------------
    # 3. ESCENARIO VELVET: Camara Alquimica de Terciopelo Azul y Oro Rosa
    # -------------------------------------------------------------------------
    c_velvet = [[(0, 0, 0, 255) for _ in range(base_w)] for _ in range(base_h)]
    for y in range(base_h):
        t = y / base_h
        for x in range(base_w):
            drape = math.sin(x * 0.12) * 0.15
            col = lerp_color((10, 20, 42), (32, 48, 86), max(0.0, min(1.0, t + drape)))
            c_velvet[y][x] = col

    # Destellos Oro Rosa y Cristales Alquimicos
    for i in range(55):
        sx = (i * 29 + 17) % base_w
        sy = (i * 31 + 11) % 72
        c_velvet[sy][sx] = (232, 165, 152, 255) if i % 2 == 0 else (255, 209, 220, 255)

    # Arcos y columnas de cristal y oro rosa
    for col_x in [25, 80, 135]:
        for y in range(25, 80):
            for dx in range(-3, 4):
                if 0 <= col_x + dx < base_w:
                    c_velvet[y][col_x + dx] = (232, 165, 152, 255) if abs(dx) == 3 else (24, 42, 76, 255)

    for x in range(base_w):
        for y in range(78, base_h):
            c_velvet[y][x] = (14, 24, 48, 255)
        c_velvet[78][x] = (232, 165, 152, 255)
    save_upscaled("velvet", c_velvet)

    # -------------------------------------------------------------------------
    # 4. ESCENARIO PENTHOUSE: Penthouse Nocturno del Hombre Citlalli
    # -------------------------------------------------------------------------
    c_penthouse = [[(0, 0, 0, 255) for _ in range(base_w)] for _ in range(base_h)]
    for y in range(base_h):
        t = y / base_h
        col = lerp_color((5, 7, 15), (18, 26, 46), t)
        for x in range(base_w):
            c_penthouse[y][x] = col

    # Estrellas en el cielo metropolitano
    for i in range(35):
        sx = (i * 43 + 5) % base_w
        sy = (i * 17 + 3) % 35
        c_penthouse[sy][sx] = (255, 232, 133, 255)

    # Skyline de Rascacielos con ventanas doradas encendidas
    buildings = [
        (6, 22, 34),
        (28, 44, 24),
        (46, 62, 40),
        (66, 86, 18),
        (88, 104, 36),
        (108, 128, 26),
        (132, 152, 32),
    ]
    for bx1, bx2, btop in buildings:
        for y in range(btop, 78):
            for x in range(bx1, bx2):
                c_penthouse[y][x] = (12, 16, 28, 255)
                if x == bx1 or x == bx2 - 1 or y == btop:
                    c_penthouse[y][x] = (45, 58, 82, 255)
                elif (x - bx1) % 3 == 1 and (y - btop) % 4 == 2 and ((x + y) % 5 != 0):
                    c_penthouse[y][x] = (212, 175, 55, 255)

    # Terraza de marmol negro con barandal dorado
    for x in range(base_w):
        for y in range(76, base_h):
            c_penthouse[y][x] = (10, 12, 18, 255)
        c_penthouse[76][x] = (212, 175, 55, 255)
    save_upscaled("penthouse", c_penthouse)

    return scenarios_info


def main():
    ensure_dirs()
    brand_files = extract_brand_assets()
    sprites_manifest = generate_sprites()
    scenarios_manifest = generate_scenarios()

    manifest = {
        "project": "CITLALLI - El Aroma de los Dioses",
        "brandAssets": brand_files,
        "pixelArtSprites": sprites_manifest,
        "pixelArtScenarios": scenarios_manifest,
    }
    manifest_path = os.path.join(PIXEL_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"[OK] Extraidos {len(brand_files)} activos de marca en {BRAND_DIR}")
    print(f"[OK] Generados {len(sprites_manifest)} sprites Pixel Art (PNG+SVG) en {SPRITES_DIR}")
    print(f"[OK] Generados {len(scenarios_manifest)} escenarios Pixel Art (640x360) en {SCENARIOS_DIR}")
    print(f"[OK] Manifiesto guardado en {manifest_path}")


if __name__ == "__main__":
    main()
