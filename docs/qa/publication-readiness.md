# QA — Preparación de publicación y anuncio

2026-10-01 · Linux x64 · Bun 1.4.2 · S42 Agent 0.1.0.
Preparación local de código fuente y materiales, sin push/release/anuncios.

## Archivos preparados

- README de presentación en inglés y README.es.md, portada y quickstart.
- Manual anterior conservado en docs/USAGE.es.md con enlaces relativos corregidos.
- CONTRIBUTING EN/ES, issue de bug/feature y plantilla de PR.
- docs/releases/v0.1.0.md para prerelease fuente; metadata de GitHub en JSON.
- Anuncios LinkedIn ES/EN, mensajes cortos, post de benchmark y carrusel 01→05.
- Social Preview horizontal generada con image_gen, inspeccionada visualmente:
  PNG maestro 1774×887 y JPEG del mismo encuadre de 250.795 bytes, inferior a 1 MB.
  El prompt se conserva. Se exportó el JPEG con ffmpeg instalado; no es una
  dependencia del harness ni se agregó al proyecto.
- Benchmark histórico identificado en README/anuncios, sin presentarlo como
  inferencia LLM o benchmark nuevo de SQLite/fuente actual.

## Validación local

| Comprobación | Resultado |
| --- | --- |
| git pull | Correcto; main sigue origin/main |
| bun install --frozen-lockfile | Exit 0; sin cambios de dependencias |
| bun run typecheck | Exit 0 |
| bun test | 161 pass, 0 fail; 2.824 assertions, 34 archivos, 19,16 s |
| Suite con D-Bus/Secret Service temporal | 161 pass, 0 fail; 2.824 assertions, 34 archivos, 19,42 s |
| index.ts --help y --version | Ayuda disponible; versión 0.1.0 |
| Copia limpia fuera del checkout | Install frozen + versión + TUI + cierre correctos |

La copia limpia se creó con git archive HEAD (677f1a6), que contiene el mismo
runtime de esta preparación. Se instaló sin node_modules del checkout y se abrió
index.ts en PTY 100×30 con SQLite temporal. Mostró Prompt y el estado inicial
sin modelo; Ctrl+Q terminó con exit 0 y restauró pantalla/cursor.
No sustituye un clon público después del push ni pruebas físicas de mouse/drop.

Logs completos locales:
`/tmp/s42-agent-launch-tests-2026-10-01.txt` y
`/tmp/s42-agent-launch-keyring-tests-2026-10-01.txt`.
Los tests usan fixtures; esta tarea no ejecutó inferencia nueva ni builds.
La QA de modelo real anterior está en [reliable-coding-and-sqlite.md](reliable-coding-and-sqlite.md).

Se verificaron 93 enlaces locales en nueve documentos, sin destinos ausentes;
Markdown renderizado con Bun, assets legibles y workflow parseado con Bun.YAML.
JSON, versión de release y metadata propuesta correctos. git diff --check pasó.
Los textos cortos tienen 239 caracteres (ES) y 230 (EN), incluyendo el enlace.

## CI remota: diagnóstico y corrección preparada

La API autenticada de GitHub reportó el repositorio privado, main como rama default,
MIT y sin descripción/topics. La
[CI de cfd09dd](https://github.com/stock42/s42-agent/actions/runs/36927765227)
había terminado con failure: 160 pass y 1 fail.
Checkout, setup-bun, frozen install y typecheck habían pasado.

El test PTY de configuración del modelo intentó guardar fixture-secret con
Bun.secrets. Sin Secret Service disponible, el formulario informó que no podía
guardar la API key y el test agotó su espera. Es una dependencia del entorno,
no una falla de inferencia ni un motivo para omitir el test.

El workflow ahora instala dbus, gnome-keyring y libsecret-1-0; ejecuta la suite
en una sesión D-Bus nueva, con XDG_DATA_HOME y control de keyring temporales,
desbloqueada con una credencial de fixture. No usa secretos de GitHub ni llavero
personal. La misma configuración pasó la suite local completa.

Esto verifica la corrección local, **no un nuevo run remoto**. Luego del push
debe comprobarse la CI del SHA publicado. El último resultado remoto sigue
siendo el fallo anterior hasta ejecutar ese paso.
Referencias: [Bun.secrets en Linux](https://bun.com/docs/runtime/secrets#linux-libsecret)
y help de gnome-keyring-daemon instalado.

## Revisión acotada de archivos publicables

- Al inicio se revisaron 221 archivos versionados y diffs de 44 commits locales
  por patrones de tokens GitHub/OpenAI, claves privadas y URLs GitHub con password.
  No se encontraron coincidencias de esos patrones.
- No había .env, bases SQLite, GGUF, PEM/KEY ni CLAUDE.md versionados.
- La credencial de origin sigue exclusivamente en .git/config, conforme al pedido
  anterior del usuario. No se copió a documentos, imágenes, logs de esta QA o JSON.
- Esta revisión por patrones no constituye una auditoría completa de secretos.
- Se conserva la modificación previa de docs/qa/final-validation.md fuera del commit.

## Pasos externos restantes

1. Subir el commit aprobado y comprobar su nueva CI.
2. Cargar metadata/portada y cambiar el repositorio a público cuando se decida.
3. Crear la prerelease fuente v0.1.0 y comprobar el enlace sin autenticación.
4. Publicar el anuncio en el canal que el usuario autorice.

No se da por probado runtime Windows/macOS/arm64, mouse/drop físico,
publicación externa o nueva inferencia. [Procedimiento](../PUBLISHING.md).
