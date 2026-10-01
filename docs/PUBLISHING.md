# Publicar S42 Agent en GitHub y anunciarlo

Repositorio: https://github.com/stock42/s42-agent · Licencia MIT.
Primera entrega propuesta: **v0.1.0, preview con fuente y seis compilados**.

Esta preparación no hace push, no cambia visibilidad, no crea una release
y no envía anuncios. `package.json` mantiene `private: true`: evita publicación
npm y no determina la visibilidad del repositorio.

## Material listo para revisar

| Material | Ubicación |
| --- | --- |
| Portada e inicio rápido en inglés | [README.md](../README.md) |
| Presentación e inicio rápido en español | [README.es.md](../README.es.md) |
| Manual detallado conservado | [USAGE.es.md](USAGE.es.md) |
| Contribuir en inglés / español | [CONTRIBUTING](../CONTRIBUTING.md) / [Español](../CONTRIBUTING.es.md) |
| Descripción, homepage, topics y datos de la release | [github-metadata.json](launch/github-metadata.json) |
| Notas para la prerelease | [v0.1.0.md](releases/v0.1.0.md) |
| Anuncios ES/EN, versión corta, benchmark y carrusel | [ANNOUNCEMENTS.md](launch/ANNOUNCEMENTS.md) |
| Diez imágenes comerciales con referencias reales, ES/EN | [Campaña](../assets/banners/s42-agent-real-tui-2026-10-01/README.md) |
| Instaladores de un comando | [Linux/macOS](../install.sh) / [Windows](../install.ps1) |
| Lista de assets para la release | [release-files.json](qa/release-files.json) |
| Compilados e instalación | [distribution.md](qa/distribution.md) |
| Vista previa social para GitHub | [social-preview.jpg](../assets/github/social-preview.jpg) |
| Validación de esta preparación | [publication-readiness.md](qa/publication-readiness.md) |

La portada social es **1774 × 887 px**, 2:1, JPEG de 250.795 bytes; su PNG maestro
se conserva junto a ella. El JPEG cumple el límite inferior a 1 MB de
[GitHub Social Preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).
GitHub recomienda 1280×640 y acepta imágenes desde 640×320.
La imagen es una ilustración comercial de la TUI, no una captura de inferencia.

## Estado verificado antes de publicar

- `main` tiene upstream `origin/main`; el pull de esta tarea terminó correctamente.
- El repositorio está **privado**, comprobado con la API autenticada de GitHub.
- Descripción y topics remotos todavía no estaban cargados al iniciar la preparación.
- Los commits de campaña/preparación deben subirse para que aparezcan en GitHub.
- La CI remota del commit `cfd09dd` falló en un test que usa el llavero del SO.
  El runner no tenía Secret Service; el workflow ahora instala las dependencias
  Linux y ejecuta la suite con D-Bus y un llavero temporal aislado.
  La corrección se comprueba localmente; una nueva CI remota requiere el push.
- Preparación posterior: seis binarios actuales generados en dist/, instalación
  Linux x64 y smoke TUI/CLI comprobados. [Registro](qa/distribution.md).
  No hay benchmark nuevo ni ejecución de Windows/macOS/ARM64.
- Las URLs públicas del repo/release/instalador respondieron 404 en esta tarea.
  Generar los archivos localmente no activa las descargas del README.

## Publicación del código y prerelease

Al ejecutar la publicación aprobada:

1. Revisar el commit local y confirmar que se suben solo los cambios de la tarea.
   `docs/qa/final-validation.md` conserva una edición local previa del usuario,
   excluida de este commit. Su benchmark no se reescribe.
2. Ejecutar `git push origin main`. Esperar la **nueva** CI del commit publicado.
   Un resultado local o el workflow preparado no equivale a CI remota aprobada.
3. En GitHub, cargar la descripción y topics de `launch/github-metadata.json`
   en **About**. En **Settings → General**, cambiar la visibilidad a pública
   cuando se decida publicar.
4. En **Settings → Social preview**, subir `assets/github/social-preview.jpg`.
5. Crear la prerelease **v0.1.0**, target **main**, con el título del JSON y las
   notas de `releases/v0.1.0.md`. Marcarla como **pre-release**.
   Adjuntar los archivos enumerados en `dist/release-files.json`: seis binarios
   actuales, SHASUMS256.txt, build-targets.json, install.sh, install.ps1 y LICENSE.
   El tag exacto v0.1.0 y los nombres son parte del contrato de los instaladores;
   no dependen de la ruta /latest, que excluye prereleases.
   Opcionalmente adjuntar `dist/s42-agent-0.1.0-all-platforms.tar.gz` como
   paquete conjunto. No subir binarios antiguos de benchmark/compare.
6. Verificar repo, raw main/install.sh, raw main/install.ps1 y assets de v0.1.0
   sin autenticación. Clonar y repetir el inicio rápido; comprobar la descarga
   de un comando del README antes de enviar el anuncio.

La autenticación de origin está en .git/config y se conserva como pidió el usuario.
No forma parte del código, assets ni archivos de publicación. La revisión de
patrones de credenciales es acotada y no garantiza ausencia de cualquier secreto;
el detalle de lo inspeccionado está en la validación enlazada.

## Anunciar el proyecto

Usar los textos listos de [ANNOUNCEMENTS.md](launch/ANNOUNCEMENTS.md).
Para LinkedIn, publicar la versión española o inglesa y adjuntar la portada o
las cinco imágenes en orden 01→05. Hay textos cortos para otros canales.

Las publicaciones se envían solo cuando el enlace sea público y haya una
instrucción explícita de publicarlas en el canal correspondiente.

Conservar en los anuncios estos datos:
- Preview con fuente/binarios, MIT y Bun; descarga solo cuando esté publicada.
- Linux probado; runtime Windows/macOS/arm64 pendiente.
- Benchmark histórico identificado, sin inferencia LLM ni pintura gráfica.
- Modelos/servidores externos y tool calling dependiente del modelo/template.

## Generar o actualizar los archivos de release

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build:release
bun run smoke:binary dist/s42-agent-0.1.0-linux-x64
bun run scripts/build-release.ts --package-only
```

El último comando incorpora el manifiesto validado al paquete sin recompilar.
El smoke indicado se ejecuta en Linux x64. Los otros destinos requieren ejecución
en su SO/arquitectura antes de declarar soporte validado.

Los archivos de dist/ no se guardan en Git; se distribuyen como assets de release.
build:release no hace push ni sube archivos a GitHub.
