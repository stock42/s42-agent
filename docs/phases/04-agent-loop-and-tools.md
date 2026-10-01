# Fase 04 — Ciclo del agente y herramientas de coding

Estado: **En curso**. Dependencias: [02](02-projects-and-sessions.md),
[03](03-providers-and-local-llm.md). Requisitos: R04, R11.
Contrato: SPECS §9 y §11.

## Objetivo

Completar una tarea de coding real: leer un proyecto, cambiar un archivo y ejecutar
su verificación, con eventos visibles, resultados persistidos y cancelación.

## Tareas

- [x] F04-01. Definir mensajes canónicos, resultados tipados y máquina de estados;
  inmovilizar proyecto, sesión y selección LLM durante cada turno.
- [x] F04-02. Implementar `read`, `list` y `search` con APIs Bun, límites claros y
  búsqueda incremental, sin requerir indexador ni herramientas instaladas extra.
- [x] F04-03. Implementar `write` y `edit` con resultado visible; el edit exacto
  exige una sola coincidencia y no modifica el archivo en los demás casos.
- [x] F04-04. Implementar `shell` con `Bun.spawn`, cwd explícito, stdout/stderr
  consumidos concurrentemente, timeout y exit code; no tomar stdin de la TUI.
- [x] F04-05. Registrar herramientas y validar nombre, argumentos e ID; ejecutar
  solamente llamadas completas y devolver un resultado por tool call.
- [x] F04-06. Conectar el loop secuencial: request, tools, resultados, request y
  respuesta final, con límite de pasos y errores de herramienta corregibles.
- [x] F04-07. Persistir tool start antes de ejecutar y tool result/turn result al
  terminar; no reejecutar una acción interrumpida al recuperar una sesión.
- [ ] F04-08. Conectar cancelación HTTP y procesos, impedir nuevas tools y validar
  terminación de descendientes según SO. Indicar efectos ya realizados.
- [x] F04-09. Implementar preparación de contexto, instrucciones AGENTS, recorte
  explícito de tool output y manejo del límite, manteniendo pares call/result.
- [x] F04-10. Renderizar estados de tools y turnos sin mezclar fallas con éxito.
- [ ] F04-11. Ejecutar escenarios fixture y una tarea real con modelo local apto
  para tool calling, registrando el diff y su verificación.
- [x] F04-12. Repetir el flujo desde el entrypoint Bun, actualizar evidencia y CHANGELOG
  y hacer el commit de cada tarea completada.

## Escenarios de aceptación

1. Repositorio fixture: el modelo solicita leer un archivo, editar una función y
   ejecutar su test. Verificar contenido final, resultado del test y registros
   call/result. Repetir con el GGUF real, distinguiendo ambas evidencias.
2. Edit con cero/dos coincidencias: archivo sin cambios y error retornado al
   modelo. Tool desconocida o JSON inválido: no se ejecutan efectos.
3. Comando con stdout y stderr abundantes: ambos se consumen sin deadlock, la TUI
   responde y el modelo recibe un recorte señalado y el exit code real.
4. Comando que falla: la interfaz y el modelo reciben la falla, no una respuesta
   fabricada de éxito. El modelo puede corregir el siguiente paso.
5. Cancelar antes de tool start, durante HTTP y durante un comando con hijo.
   No iniciar tools siguientes y no dejar procesos iniciados por ese turno.
6. Cortar el proceso tras tool start y antes de tool result: al reabrir no repetir
   la tool y mostrar el estado interrumpido, aunque pudo haber tenido efectos.
7. Un fixture solicita herramientas indefinidamente: termina por límite de pasos
   con motivo explícito. Contexto excedido informa el límite y permite `/new`.
8. Registrar dos carpetas con nombres/rutas que incluyen espacios: las tools
   operan sobre el proyecto del turno y conservan rutas exactas.

## Evidencia

| Tarea/caso | Fixture, comando o diff | Resultado, modelo y exit code |
| --- | --- | --- |
| Loop y herramientas | `bun run typecheck`; `bun test tests/agent.test.ts tests/storage.test.ts` | 10 casos pasan; fixture HTTP lee, edita y ejecuta Bun con resultado 4. Edición ambigua/JSON inválido sin cambios; límite de pasos; stdout/stderr abundantes; timeout. |
| Cancelación/recuperación | Tests de grupo de procesos y sesión interrumpida | Linux: descendiente detenido al cancelar; lock de PID muerto y pares call/result reparados sin repetir efectos. Otros SO pendientes. |
| Modelo real / fuente interactiva | Pendiente | No hay endpoint/modelo real disponible; fixture no demuestra inferencia real. |

## Cierre

Un modelo local realiza lectura, edición y verificación real; errores, cancelación
y recuperación funcionan. Las tools siguen corriendo con los permisos del usuario,
sin un sandbox implícito ni acciones Git automáticas no solicitadas.
