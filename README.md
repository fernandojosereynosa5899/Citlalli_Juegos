# Catálogo de Sprites, Escenarios y Cosméticos CITLALLI ("El Aroma de los Dioses")

Este paquete contiene todos los recursos visuales, cosméticos, sprites pixel art (vectoriales SVG y raster PNG nítidos), escenarios temáticos, elementos de gabinete arcade, fotografía de producto y base de datos oficial para ser utilizados directamente en cualquier otro proyecto (HTML5 Canvas, Phaser, Godot, Unity, React, Astro, Vue, Flutter, etc.).

---

## 📁 Estructura del Paquete (`C:\Citlalli_2`)

```
C:\Citlalli_2\
├── pixel-art\
│   ├── sprites\                  # 15 Sprites individuales (PNG + SVG) + Spritesheet maestro
│   ├── scenarios\                # 4 Paisajes mesoamericanos en Pixel Art retro y versión HD
│   ├── cabinet\                  # Marquesina iluminada, trofeo oficial y key visuals
│   └── manifest.json             # Metadatos, coordenadas de spritesheet y paletas hex
├── brand\                        # Fotografía publicitaria de producto, frasco, caja y logos
├── scripts\                      # Script generador en Python con matrices 12x12
├── database\                     # Schema PostgreSQL con juego limpio, triggers e índices
└── README.md                     # Guía de integración y catálogo
```

---

## 🎨 1. Sprites Pixel Art (`pixel-art/sprites/`)

Todos los sprites fueron diseñados con cuadrículas nítidas `shape-rendering="crispEdges"` en SVG vectorial y PNG escalable:

| Sprite | Archivo PNG / SVG | Dimensiones | Categoría Olfativa / Simbólica | Lore Oficial |
| :--- | :--- | :---: | :--- | :--- |
| **Frasco Citlalli** | `bottle_citlalli` | 12×12 | Frasco Insignia | Cristal facetado con elixir ámbar y dije grabado. |
| **Frasco Alado** | `bottle_winged` | 14×12 | Frasco Celestial | Elixir con alas de luz que surca hacia las estrellas. |
| **Dije QM** | `charm_qm` | 12×12 | Joya / Oro Rosa | Medallón grabado con el sello sagrado de la firma. |
| **Jaguar Dorado** | `jaguar_gold` | 12×12 | Guardián Sagrado | Felino ancestral con ojos de esmeralda y colmillos. |
| **Estrella Astral** | `star_citlalli` | 12×12 | Cosmos / Astral | La estrella guía en náhuatl; activa Fiebre Astral x2. |
| **Mandarina** | `mandarin` | 12×12 | Nota de Salida | Chispa cítrica y luminosa recolectada al amanecer. |
| **Rosa Rosada** | `rose_pink` | 12×12 | Nota de Corazón | Pétalos de romance aterciopelado de alta perfumería. |
| **Jazmín Blanco** | `jasmine_white` | 12×12 | Nota de Corazón | Flor estelar nocturna de blancura impoluta. |
| **Vainilla** | `vanilla_pod` | 12×12 | Nota de Fondo | Vaina dulce de Papantla que abriga la piel. |
| **Ámbar Cristal** | `amber_crystal` | 12×12 | Nota de Fondo | Resina fosilizada que sella la longevidad eterna. |
| **Vasija de David** | `clay_vessel` | 12×12 | Origen Sagrado | Barro cocido de Hidalgo modelado en el primer boceto. |
| **Cresta Quetzal** | `snake_head_gold` | 12×12 | Serpiente Astral | Cabeza de serpiente con cresta de Quetzal en oro. |
| **Cresta Oro Rosa** | `snake_head_rosegold` | 12×12 | Serpiente Rosa | Variante femenina en oro rosa y gemas. |
| **Humo Amargo** | `smoke_hazard` | 12×12 | Trampa Alquímica | Nube de humo grisáceo que penaliza puntuación. |
| **Caja Terciopelo** | `card_back_velvet` | 12×16 | Estuche Atelier | Reverso con estrella de 8 puntas y nubes celestes. |
| **Spritesheet** | `spritesheet_citlalli` | 96×72 | Hoja Maestra | Atlas con todos los sprites alineados en cuadrícula. |

---

## 🌌 2. Escenarios y Fondos Mesoamericanos (`pixel-art/scenarios/`)

Cada paisaje cuenta con su versión pixel art nativa (ligera para retro games) y su versión `_hd` en alta resolución:

1. **Noche en Hidalgo** (`scenario_hidalgo.png` / `_hd.png`):
   - Manto estrellado azul profundo (`#060B1A`) con el árbol ancestral hidalguense y destellos celestes.
2. **Cueva del Jaguar** (`scenario_jaguar.png` / `_hd.png`):
   - Templo piramidal con relieves de piedra, antorchas de copal, braseros de ámbar y tono terracota cálido (`#120A05`).
3. **Atelier Velvet** (`scenario_velvet.png` / `_hd.png`):
   - Cámara de terciopelo azul marino (`#091124`), filigrana en oro rosa (`#E0A98B`) y frascos facetados.
4. **Penthouse Cósmico** (`scenario_penthouse.png` / `_hd.png`):
   - Vista nocturna metropolitana (`#05070F`) desde un rascacielos de alta gama hacia la constelación Citlalli.

---

## 🕹️ 3. Elementos de Gabinete Arcade (`pixel-art/cabinet/`)

- `citlalli_arcade_marquee.png`: Marquesina retroiluminada de gabinete arcade con marco dorado y tipografía grabada.
- `citlalli_trophy_emblem.png`: Emblema heráldico con corona dorada y laurel para premiar al campeón #1.
- `scenario_*_art_*.jpg`: Obras de arte conceptual originales en ultra alta resolución (1024×1024).

---

## 💎 4. Identidad de Marca y Fotografía (`brand/`)

- `logo.png` & `emblem_cosmic.png`: Logotipos oficiales e isotipos vectorizados.
- `bottle.png` & `box.png`: Renders y fotografía del frasco de cristal facetado (50 ML) y estuche de lujo.
- `label_back.png`: Etiqueta posterior con ingredientes y notas.
- `ad_poster_luxury.jpeg` & `ad_poster_jaguar.png`: Afiches publicitarios de campaña.
- `ad_promo.gif`: Comercial animado promocional oficial.
- `moodboard.png`, `notes_velvet_1.png`, `notes_velvet_2.png`: Moodboards y desgloses de pirámide olfativa.
- `instructions_card.png`: Tarjeta de uso y ritual de aplicación.
- `storytelling_david.jpeg`: Fotografía de proceso artesanal.

---

## ⚙️ 5. Script Generador en Python (`scripts/generate_pixel_assets.py`)

Incluye el generador paramétrico en Python puro con matrices ASCII, paletas de color hex y exportador automático a PNG y SVG. Para regenerar o cambiar tamaños:
```bash
python scripts/generate_pixel_assets.py
```

---

## 🗄️ 6. Base de Datos PostgreSQL (`database/citlalli_postgres.sql`)

Incluye:
- Tabla `citlalli_players` con restricción estricta de **8 caracteres máximo** por usuario y avatar oficial.
- Tabla `citlalli_leaderboard` para puntuaciones.
- Triggers anti-trampas (`fn_citlalli_anti_cheat_guard`) para juego limpio y sano.
- Vista `v_citlalli_clean_leaderboard` para garantizar que cada jugador compita solo con su mejor récord personal.
- Vista `v_citlalli_top10` y función `fn_get_clean_arcade_records_json()` para alimentar la API REST.
- Procedimientos de reinicio y sanción.

---

## 🕹️ 7. Sala Arcade CITLALLI (`arcade/`)

Suite completa con 4 minijuegos retro pixel art en Canvas 2D nativo a 60 FPS:
1. **La Víborita (`arcade/js/games/snake.js`)**: Serpiente esmeralda con cresta de Quetzal, lengua bífida animada y notas de la pirámide olfativa (Mandarina, Rosa, Jazmín, Vainilla, Ámbar, Frasco y Estrella Astral con Fiebre Astral x2).
2. **Flappy Citlalli (`arcade/js/games/flappy.js`)**: Frasco alado en cristal facetado volando entre columnas de mármol negro coronadas por cabezas de Jaguar Dorado, con medallones `charm_qm` para escudo protector.
3. **Memorama Atelier (`arcade/js/games/memorama.js`)**: 10 pares de la firma en tarjetas de terciopelo azul marino `#0D1736` con giro 3D, categorías olfativas y banner interactivo de victoria.
4. **Reflejos (`arcade/js/games/reflejos.js`)**: Destilación alquímica contra reloj (20 s) con orbes de esencias vivas, penalización por humo amargo (`smoke_hazard`) y telemetría de milisegundos en tiempo real.

### Cómo Ejecutar:
- **Modo directo (sin servidor)**: Abrir `arcade/index.html` con doble clic en cualquier navegador. Funciona al 100% con almacenamiento en RAM y respaldo en `localStorage`.
- **Modo servidor local + API**:
  ```bash
  node server/server.js
  ```
  Acceder en el navegador a: `http://localhost:8080/arcade/`

