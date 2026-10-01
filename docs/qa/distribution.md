# Distribución e instalación · 2026-10-01

Pedido: README inglés/español con imágenes, selector de idioma, instalación de
un comando por SO, explicación de Bun/clonación y compilados por plataforma.

## Archivos preparados

- [README.md](../../README.md) en inglés y [README.es.md](../../README.es.md) en
  español. Enlaces de idioma visibles al inicio; las cinco piezas nuevas de cada
  idioma y la galería real se conservan en ambos README.
- Instalación de Bun 1.4.2 para Linux/macOS/Windows, requisitos, clonación,
  frozen install, inicio, uso del binario y builds documentados.
- [install.sh](../../install.sh) para Linux/macOS y
  [install.ps1](../../install.ps1) para Windows. Detectan x64/ARM64, seleccionan
  el asset de v0.1.0, verifican SHA-256 y versión, instalan para el usuario y
  configuran PATH. FromDirectory/from-dir usa una entrega local; no-modify-path
  evita tocar perfiles o registro durante QA.
- `bun run build:release`: seis compilados nuevos, manifiesto, SHASUMS256.txt,
  instaladores, LICENSE y paquete all-platforms.tar.gz en dist/, fuera de Git.
  [Lista exacta de uploads](release-files.json), sin publicación automática.
- Fuente de runtime conservada; cambios en scripts/build, instaladores, tests
  y documentación. Build usa Bun Shell; paquete usa Bun.Archive nativo.

## Compilados

[Manifiesto y SHA-256](distribution-builds.json), generados con Bun 1.4.2:

| Target | Formato comprobado | Runtime |
| --- | --- | --- |
| bun-linux-x64 | ELF x86-64 | Smoke, instalación y CLI locales correctos |
| bun-linux-arm64 | ELF AArch64 | Pendiente en destino |
| bun-darwin-x64 | Mach-O x86-64 | Pendiente en destino |
| bun-darwin-arm64 | Mach-O ARM64 | Pendiente en destino |
| bun-windows-x64 | PE32+ x86-64 | Pendiente en destino |
| bun-windows-arm64 | PE32+ AArch64 | Pendiente en destino |

El código runtime parte de 2ce9179; la build incluye la nueva definición de
scripts en package.json. Los hashes identifican los artefactos efectivos.
No se ejecutó benchmark ni se sustituyeron los resultados históricos.

El paquete final contiene doce archivos, incluidos los seis ejecutables.
[Registro de validación](release-bundle.json): gzip real, 202.649.279 bytes,
seis tamaños/hashes correctos y metadata/instaladores idénticos a dist/.
Se comprobaron firma gzip, lectura completa con Bun.Archive y CRC con gzip -t.

En Bun 1.4.2, pasar Bun.file sin materializar a los valores de Archive produjo
entradas vacías; escribir Archive directamente no preservó gzip. Ambas salidas
se detectaron durante QA y se reemplazaron: leer .bytes() de cada archivo y
serializar .bytes() del Archive antes de Bun.write. Solo se entrega el paquete
final completo y comprimido.

## Verificación ejecutada

- `bun install --frozen-lockfile`: correcto, sin cambios de dependencias.
- `bun run typecheck`: correcto, incluido el script de empaquetado final.
- Suite completa con D-Bus/Secret Service temporal aislado: **177 pass, 0 fail**,
  3046 assertions, 37 archivos. Log local: out/qa/distribution/tests.txt.
- Cinco tests del instalador Unix: rutas con espacios, instalación local,
  integridad, descarga HTTP, 404 sin reemplazar el anterior y selección macOS
  ARM64 con uname simulado. Esa selección no prueba ejecución en macOS.
- `bash -n install.sh`: correcto. PowerShell 7.6.6 temporal en Linux parseó
  install.ps1 sin errores; no es una prueba de runtime Windows/PowerShell 5.1.
- [Smoke TUI del Linux x64](distribution-binary-smoke.json): fuera del checkout, PATH sin
  Bun/Node, cinco requests con fixtures HTTP, read/edit/shell, MCP, skill externa,
  archivo modificado y restauración del terminal comprobados; exit 0.
  El fixture se corrigió para responder 404 a GET /props, en lugar de intentar
  parsear JSON de una request GET y producir un error del servidor de pruebas.
- [Instalación local y CLI](native-installer-cli.json): compilado instalado en
  carpeta temporal, versión 0.1.0, CLI sin Bun/Node en PATH, dos requests con
  fixture LLM, tool write creando el archivo y respuesta final; exit 0.
- [Bootstrap HTTP completo](http-installer.json): curl del script real, pipe a
  Bash, descarga de SHASUMS256.txt y binario real desde Bun.serve; SHA-256 del
  ejecutable instalado coincide. Sin cambios a perfiles/configuración personales.
- 191 enlaces locales de siete documentos comprobados, con imágenes existentes
  y git diff --check correcto. Los 35 hashes de fotos originales coinciden.
  Seis hashes de ejecutables y entradas de checksums comprobados. Los manifiestos
  históricos build-targets.json/binary-smoke.json y las campañas se conservan;
  esta entrega usa distribution-builds.json/distribution-binary-smoke.json.

## Alcance de publicación

El 2026-10-01, las consultas públicas al repo, la release v0.1.0 y raw install.sh
respondieron HTTP 404. No se usaron credenciales para esas consultas. Los README
identifican los comandos remotos como preparados para cuando se publiquen el
código y los assets; la instalación local desde dist/ ya está comprobada.

[Pasos para publicar](../PUBLISHING.md): push/visibilidad/release/uploads y
verificación de URLs públicas siguen pendientes. Esta tarea no hizo push,
publicó releases ni envió anuncios. Los otros cinco runtimes siguen pendientes.

Pull previo correcto. Edición ajena de final-validation.md preservada fuera del
commit. Config SQLite, instalación y llavero de QA temporales; nada personal
reemplazado.

## Fuentes oficiales consultadas

- [Instalación y requisitos de Bun](https://bun.com/docs/installation).
- [Ejecutables y targets Bun](https://bun.com/docs/bundler/executables).
- [Bun.Archive](https://bun.com/docs/runtime/archive).
- [PowerShell 7.6.6 para la comprobación de sintaxis](https://github.com/PowerShell/PowerShell/releases/tag/v7.6.6).
