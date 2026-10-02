# Preparar y publicar una release

[English](PUBLISHING.md) · **Español**

S42 Agent distribuye fuente y seis ejecutables: Linux glibc, macOS y Windows,
cada uno x64/ARM64. Los compilados incluyen Bun; el servidor LLM, modelos y
programas externos siguen siendo independientes. Los archivos generados quedan
en `dist/`, fuera de Git.

## Preparación local

Requiere Bun 1.4.2. Usar configuración y proyectos temporales para las pruebas.
La [guía de contribución](../CONTRIBUTING.es.md) y el workflow describen las
necesidades del llavero aislado para los tests Linux.

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:release
bun run smoke:binary dist/s42-agent-0.1.0-linux-x64
bun run scripts/build-release.ts --package-only
bun run scripts/release-draft.ts
```

El smoke indicado se ejecuta en Linux x64, fuera del checkout y sin Bun/Node
en PATH. Genera `dist/binary-smoke.json` y actualiza el manifiesto de builds.
`--package-only` incorpora ese manifiesto al paquete sin recompilar.
Otros destinos requieren ejecución en su SO/arquitectura para validar runtime;
la compilación cruzada solo verifica la generación del ejecutable.

`build:release` genera los seis binarios, `SHASUMS256.txt`, `build-targets.json`,
los instaladores, LICENSE, `release-files.json` y un paquete all-platforms.tar.gz.
El [chequeo local](../scripts/release-draft.ts) valida versión, targets, tamaños,
hashes/checksums, copias de instaladores/licencia y enlaces de las notas. Por
defecto solo imprime el plan de once assets; no crea ni publica una release.

La [metadata de release](releases/metadata.json) contiene únicamente repositorio,
tag, título y ruta de notas. Mantenerla alineada con `package.json` y las
[notas](releases/v0.1.0.es.md). Los nombres de archivos y el tag forman parte del
contrato de los instaladores. Los comandos anteriores no necesitan `private/`.

## Workflow manual

Después de subir el commit autorizado y comprobar su CI:

1. Abrir **Actions → Prepare draft release → Run workflow**, seleccionando main.
2. El [workflow](../.github/workflows/release.yml) verifica tipos y tests con
   llavero temporal, genera seis destinos, ejecuta el smoke Linux y empaqueta.
3. Crea una **draft prerelease** con once assets, usando el SHA del run como
   target. Revisar el borrador antes de publicarlo.
4. Después de publicar, comprobar las URLs de descarga y ambos instaladores.

Solo `workflow_dispatch` inicia este flujo. Usa GITHUB_TOKEN con contents: write;
los pushes/PR no crean releases. Una release existente no se reemplaza.

También puede crearse el borrador con GitHub CLI autenticado:

```bash
bun run scripts/release-draft.ts --create
```

Este comando requiere autorización explícita para subir el borrador y que HEAD
ya esté en el remoto. No hace push ni publica el borrador. El paquete
all-platforms.tar.gz puede adjuntarse como asset adicional.

## Archivos públicos

Conservar los README [EN](../README.md)/[ES](../README.es.md), manual
[EN](USAGE.md)/[ES](USAGE.es.md), contratos de tools [EN](TOOLS.md)/[ES](TOOLS.es.md),
guía de contribución [EN](../CONTRIBUTING.md)/[ES](../CONTRIBUTING.es.md), LICENSE
y notas de release [EN](releases/v0.1.0.md)/[ES](releases/v0.1.0.es.md).
La galería [EN](../screenshots/README.md)/[ES](../screenshots/README.es.md) muestra
la TUI real; el [JPEG social](../assets/github/social-preview.jpg) sirve como
portada para GitHub. Campañas, anuncios, prompts de imágenes, planes e informes
locales permanecen en `private/`, ignorado por Git.

No hacer push, cambiar visibilidad, ejecutar el workflow, subir una release o
publicar anuncios sin pedido explícito. `package.json` conserva `private: true`
porque no se publica un paquete npm.
