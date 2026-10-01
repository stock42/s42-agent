# Fase 02 — Configuración, proyectos y sesiones

Estado: **Completada**. Dependencias: [00](00-tui-viability.md),
[01](01-terminal-ui.md). Requisitos: R06, R12.
Contratos: SPECS §6, §7 y §11.

## Objetivo

Administrar proyectos por nombre/carpeta y conservar sesiones independientes
mediante archivos locales legibles y recuperables.

## Tareas

- [x] F02-01. Definir tipos y validación pequeña de configuración v1, proyectos,
  modelos y eventos de sesión. No incorporar un framework de schemas sin necesidad.
- [x] F02-02. Resolver directorios de configuración/estado según SO y `--config`;
  guardar config con temporal y rename, conservando la última versión válida.
- [x] F02-03. Implementar alta, edición, listado, selección y baja del registro
  de proyectos en la TUI; comprobar carpeta y normalizar paths.
- [x] F02-04. Implementar `--project`, `--cwd`, último proyecto y errores de nombres
  ambiguos, carpeta ausente y registros duplicados.
- [x] F02-05. Crear sesiones JSONL por ID, listarlas por proyecto y reabrirlas en
  idle. Mantener defaults y selección de sesión como conceptos separados.
- [x] F02-06. Implementar append serializado y recuperación de última línea
  incompleta, con errores explícitos en líneas completas corruptas.
- [x] F02-07. Representar herramientas iniciadas sin resultado como interrumpidas,
  sin reejecutarlas al reabrir. Preparar el contrato que usará la fase 04.
- [x] F02-08. Detectar intento de abrir una misma sesión para escritura desde dos
  instancias. Probar también recuperación después de un cierre inesperado.
- [x] F02-09. Persistir borrador al cambiar sesión/proyecto y cerrar normalmente.
  Prohibir cambio de proyecto en turno activo, conservando el borrador actual.
- [x] F02-10. Cargar instrucciones AGENTS aplicables sin mezclar proyectos y sin
  inventar políticas Git para las carpetas registradas.
- [x] F02-11. Validar config, sesiones y proyectos desde el entrypoint Bun. Registrar
  evidencia, actualizar CHANGELOG y hacer el commit de cada tarea completada.
- [x] F02-12. Mantener Projects con solo Name y Folder; elegir carpeta mediante
  explorador libre y conservar formulario/borrador al abrir/cerrar previews.

## Escenarios de aceptación

1. Registrar A y B con carpetas distintas, una sin Git; editar sus nombres,
   abrir sesiones y escribir borradores diferentes. Alternar y reabrir conserva
   cada borrador/historial en su proyecto.
2. Cambiar el path de A y borrar B del registro. No se borran archivos ni sesiones.
   Una ruta inválida se informa y no reemplaza la configuración válida.
3. Simular fallo antes del rename de config: al reiniciar todavía se lee la última
   versión completa. Un JSON inválido no se sobrescribe con defaults silenciosos.
4. Cortar el último registro JSONL y reabrir: conservar anteriores y mostrar
   recuperación. Corromper una línea intermedia: mostrar el error concreto.
5. Abrir un registro con tool start sin tool result: queda interrumpido y no se
   ejecuta ninguna acción ni llamada LLM durante la recuperación.
6. Intentar escribir una sesión desde dos procesos: el segundo no agrega registros
   concurrentemente y puede crear una nueva. Repetir tras matar el primer proceso.
7. Comprobar precedencia de CLI, proyecto, default y selección de sesión; una
   referencia eliminada pide elegir nuevamente sin enviar un request.

## Evidencia

| Tarea/caso | Fixture, comando o captura | Resultado y archivos afectados |
| --- | --- | --- |
| Config/proyectos/sesiones | `bun run typecheck`; `bun test tests/storage.test.ts tests/workspace.test.ts` | 13 casos correctos: normalización, JSON inválido, append, lock, recuperación, separación y aviso Models. |
| Recuperación / AGENTS | `bun test tests/storage.test.ts tests/agent.test.ts` | Segundo proceso obtiene lock; apertura concurrente rechazada y reapertura tras matarlo. Instrucciones raíz/subcarpeta y separación entre proyectos verificadas. |
| Entry point | `bun test tests/app-terminal.test.ts` | Configuración, sesión y borrador reabiertos desde index.ts en PTY. |
| Projects / folder picker | `bun test tests/explorer.test.ts tests/app-terminal.test.ts` | Name/Folder por teclado y mouse inyectado, folder externo, preview anidado, alta/reapertura y carpeta inválida conservando config previa. [QA](../qa/explorer-and-reasoning.md). |

## Cierre

Dos proyectos operables, sesiones reanudables y recuperación comprobada, sin
DB ni servicio adicional y sin depender del cwd global del proceso.
