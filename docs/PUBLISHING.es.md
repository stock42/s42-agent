# Preparar y publicar una release

[English](PUBLISHING.md) · **Español**

S42 Agent distribuye fuente y seis ejecutables: Linux glibc, macOS y Windows,
cada uno x64/ARM64. Los compilados incluyen Bun; el servidor LLM, modelos y
programas externos siguen siendo independientes. Los archivos generados quedan
en `dist/`, fuera de Git.

## Preparación local

Requiere Bun 1.4.2. Usar configuración y proyectos temporales para las pruebas.
La [guía de contribución](../CONTRIBUTING.es.md) describe las pruebas de
credenciales con SQLite temporal; no requieren servicios de llavero Linux.

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:release
bun run smoke:binary dist/s42-agent-0.1.2-linux-x64
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
[notas](releases/v0.1.2.es.md). Los nombres de archivos y el tag forman parte del
contrato de los instaladores. Los comandos anteriores no necesitan `private/`.

## Workflow manual

El usuario autorizó al asistente a administrar packages y releases del proyecto.
La preferencia es publicar prereleases en este repositorio. Usar
el acceso GitHub configurado, sin guardar credenciales en la fuente ni cambiar
la visibilidad del repositorio.

Después de subir el commit de la tarea terminada y comprobar su CI:

1. Abrir **Actions → Prepare draft release → Run workflow**, seleccionando main.
2. El [workflow](../.github/workflows/release.yml) verifica tipos y tests con
   credenciales SQLite temporales, genera seis destinos, ejecuta el smoke Linux
   y empaqueta.
3. Crea una **draft prerelease** con once assets de distribución y sube el paquete
   tar.gz conjunto como duodécimo asset. El target es el SHA del run.
4. Verificar nombres, tamaños, SHA-256 y evidencia de runtime Linux en el
   manifiesto de builds; después publicar el borrador comprobado como prerelease.
5. Comprobar la release publicada y las descargas con acceso GitHub autorizado.

Solo `workflow_dispatch` inicia este flujo. Usa GITHUB_TOKEN con contents: write;
los pushes/PR no crean releases. Una release existente no se reemplaza.

También puede crearse el borrador con GitHub CLI autenticado:

```bash
bun run scripts/release-draft.ts --create
```

La autorización del usuario cubre subir este borrador; HEAD debe estar en el
remoto. El comando no hace push ni publica el borrador. Adjuntar también el
all-platforms.tar.gz generado, verificar y publicar la prerelease. El workflow
hace esa subida adicional automáticamente. Un cliente autenticado de la API
GitHub puede iniciar el workflow y publicar su borrador verificado.

## Archivos públicos

Conservar los README [EN](../README.md)/[ES](../README.es.md), manual
[EN](USAGE.md)/[ES](USAGE.es.md), contratos de tools [EN](TOOLS.md)/[ES](TOOLS.es.md),
guía de contribución [EN](../CONTRIBUTING.md)/[ES](../CONTRIBUTING.es.md), LICENSE
y notas de release [EN](releases/v0.1.2.md)/[ES](releases/v0.1.2.es.md).
La galería [EN](../screenshots/README.md)/[ES](../screenshots/README.es.md) muestra
la TUI real; el [JPEG social](../assets/github/social-preview.jpg) sirve como
portada para GitHub. Campañas, anuncios, prompts de imágenes, planes e informes
locales permanecen en `private/`, ignorado por Git.

Terminar cada tarea con su actualización de CHANGELOG, commit y push a la rama
remota configurada, por pedido del usuario. Las tareas de distribución incluyen
ejecutar el workflow y publicar prereleases verificadas en este repositorio.
Cambios de visibilidad y anuncios externos siguen requiriendo pedido explícito.
`package.json` conserva `private: true` porque no se publica un paquete npm.
