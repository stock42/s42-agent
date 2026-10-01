# Fase 19 — WebServer del proyecto

Requisito R34. Dependencias: 10, 13, 15, 17.
Estado: **implementación y QA fuente completadas en Linux**. Apertura del
navegador en Windows/macOS pendiente de ejecución en esos sistemas.

## Tareas

- [x] Tools → WebServer con puerto configurable y document root del proyecto activo.
- [x] Servidor nativo Bun.serve/Bun.file: HTML/CSS/JS, binarios, MIME, GET/HEAD y rangos.
- [x] index.html o listado navegable; rutas Unicode/espacios y cambios por refresh.
- [x] Abrir navegador por Bun Shell; preview directa del archivo activo dentro de raíz.
- [x] Iniciar/Aplicar, Detener, Abrir navegador, estado/URL y errores en el diálogo.
- [x] Conservar servidor anterior si el puerto nuevo está ocupado; mantener URL si falla browser.
- [x] Un servidor por proyecto; cerrar proyecto/cambiar carpeta/salir libera recursos.
- [x] ES/EN, mouse/teclado, foco tras error y 60×16 sin tapar el prompt.
- [x] Tests HTTP y App, entrypoint real en PTY y navegador real con CSS/JS/imagen.
- [x] README EN/ES, manual, SPECS, AGENTS, CHANGELOG y evidencia.
- [ ] Ejecutar open en macOS y cmd.exe start en Windows en sus sistemas de destino.

## Evidencia

| Comprobación | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto, Bun 1.4.2 / TypeScript 7.0.2 |
| `bun test tests/webserver.test.ts tests/internal-tools.test.ts` | 12 pass / 0 fail |
| `bun test` | 172 pass / 0 fail, 36 archivos, 3032 assertions |
| index.ts PTY + apertura nativa Linux → Chrome | HTML/CSS/JS/imagen cargados y clic JavaScript funcional |
| Detener con mouse; salir con Ctrl+Q | Puerto liberado y proceso con exit 0 |
| [QA y capturas](../qa/webserver.md) | Escenarios y limitaciones registrados |

Sin paquetes de runtime nuevos, binarios, hot reload, bundler ni backend de
aplicación. Utilidad del menú; el catálogo de tools LLM conserva 12 entradas.
