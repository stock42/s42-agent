# Cierre de preparación de publicación · 2026-10-01

Pedido: dejar todo listo para publicar. Preparación local, sin push, cambio de
visibilidad, release remota o anuncios enviados.

## Entrega

- [Workflow manual](../../.github/workflows/release.yml): solo workflow_dispatch
  sobre main; Bun 1.4.2, frozen install, tipos, suite con Secret Service temporal,
  seis builds, smoke Linux x64, empaquetado y draft/prerelease con once assets.
  Usa el GITHUB_TOKEN del run. El SHA del checkout determina el target del tag.
- [release-draft.ts](../../scripts/release-draft.ts): sin flags verifica el dist
  existente y muestra el plan; --create ejecuta gh release create con draft,
  prerelease, target HEAD exacto, notes-file y la lista comprobada de archivos.
  No hace push ni publica el borrador. GitHub CLI se requiere solo al crear.
- [Notas de v0.1.0](../releases/v0.1.0.md): URLs absolutas al tag para que sus
  enlaces funcionen al pegarlas en GitHub Releases.
- [Anuncios ES/EN](../launch/ANNOUNCEMENTS.md): campaña final en ambos idiomas,
  WebServer, números de línea y entrega de fuente/binarios; benchmark histórico
  y limitaciones de runtime conservados.
- [Procedimiento](../PUBLISHING.md), metadata y AGENTS actualizados.

## Verificación local

- git pull --ff-only correcto; main ya estaba sincronizada con origin/main.
- bun run typecheck correcto.
- bun test tests/release-draft.test.ts: **4 pass, 0 fail**, 9 assertions.
  Cobertura: plan exacto sin GitHub, binario corrupto, versión/checksum erróneos,
  copia de instalador vieja y enlaces relativos inválidos para la release.
- Plan real contra dist: seis tamaños/SHA-256 coinciden con build-targets.json
  y SHASUMS256.txt; instaladores/licencia coinciden con sus archivos fuente.
  Once assets exactos, sin binarios antiguos de benchmarks.
- Workflow parseado con Bun.YAML; ocho scripts run comprobados con bash -n.
- Rama --create ejecutada con un gh local de fixture: se comprobaron los once
  paths, notas, target SHA y flags draft/prerelease/latest=false. El fixture solo
  guardó argumentos: ninguna llamada a GitHub ni modificación remota.
- 195 enlaces locales y enlaces absolutos al tag comprobados contra el árbol actual;
  git diff --check correcto. Plan/logs en out/qa/release-preparation/.

No cambió index.ts, src/, package.json ni la definición del build. Los seis
binarios y el paquete ya verificados en [distribution.md](distribution.md)
se conservan sin recompilar. La suite completa anterior de 177 tests es evidencia
de distribución; esta tarea ejecutó las cuatro pruebas nuevas y el typecheck.
No hay benchmark nuevo ni validación adicional Windows/macOS/ARM64.

La edición previa de final-validation.md sigue fuera del commit. Configuración,
llavero, perfiles y credenciales personales conservados.

## Estado externo

El workflow queda preparado para ejecutarlo después de subir main. La ejecución
remota y creación del borrador no se hicieron. Para habilitar los instaladores
públicos faltan el push, repo público y publicación de v0.1.0 con los once assets.
Los anuncios quedan listos para enviar cuando se comprueben esos enlaces.

Referencias oficiales: [workflow manual](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[gh release create](https://cli.github.com/manual/gh_release_create).
