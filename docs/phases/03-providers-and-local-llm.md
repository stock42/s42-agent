# Fase 03 — Proveedores, modelos y streaming con llama.cpp

Estado: **En curso**. Dependencias: [01](01-terminal-ui.md),
[02](02-projects-and-sessions.md). Requisitos: R09, R10.
Contratos: SPECS §7 y §8.

## Objetivo

Enviar un mensaje a un servidor local real y recibir streaming cancelable;
administrar otros endpoints/modelos mediante el mismo contrato inicial.

## Tareas

- [x] F03-01. Crear el proveedor inicial `llama.cpp` en
  `http://127.0.0.1:8080/v1`, sin inventar un modelo ni exigir una clave cloud.
- [x] F03-02. Implementar formularios/listados de proveedores y modelos, elección
  actual, defaults y capacidades explícitas. Reutilizar los selectores de fase 01.
- [x] F03-03. Implementar descubrimiento `/models` opcional y registro manual
  cuando no esté disponible; no inferir herramientas/visión del nombre del modelo.
- [x] F03-04. Construir requests Chat Completions con `fetch`, baseUrl normalizado,
  credenciales desde la variable configurada y un `AbortController` por turno.
- [x] F03-05. Implementar SSE incremental, deltas de texto y reconstrucción de tool
  calls, incluyendo argumentos parciales. Todavía no ejecutar herramientas.
- [x] F03-06. Resolver estados de conexión, streaming, fin, cancelación y error;
  soportar primer evento lento e inactividad configurable sin bloquear la TUI.
- [x] F03-07. Mostrar datos de uso reportados y su ausencia, conservar texto parcial
  y selecciones en sesión; no persistir claves ni cabeceras de autenticación.
- [ ] F03-08. Probar endpoints fixture independientes para dos proveedores, con
  defaults distintos, errores HTTP y streams truncados.
- [ ] F03-09. Validar streaming/cancelación con `llama-server` y un GGUF real. Anotar
  versiones, modelo, template y contexto; documentar cómo iniciar el servidor.
- [ ] F03-10. Repetir el flujo desde el entrypoint Bun. Registrar evidencia, actualizar
  CHANGELOG y hacer el commit de cada tarea completada.

## Escenarios de aceptación

1. Sin servidor LLM, iniciar TUI, cambiar endpoint y registrar proyecto. La
   interfaz no queda esperando una conexión para poder usarse.
2. Fixture SSE con JSON, CRLF y Unicode partidos byte a byte; contiene varios
   eventos por chunk y `[DONE]`. El resultado coincide con el mensaje esperado.
3. Recibir dos tool calls con argumentos intercalados: reconstruir cada una por
   índice/ID; ninguna se ejecuta durante la recepción parcial.
4. Simular 401, 404, 429, 503, desconexión sin fin e inactividad. El estado explica
   la causa, conserva el mensaje parcial y permite otro turno sin retry automático.
5. Seleccionar proveedores A/B con un mismo ID de modelo. El request usa endpoint,
   credencial y modelo correctos; al reabrir se mantiene la selección de la sesión.
6. Servidor local real: enviar y cancelar una generación; la TUI vuelve a idle.
   No afirmar todavía coding real solo porque devuelve texto.
7. Una variable de credencial ausente produce un error antes del request al
   proveedor que la exige; sesiones y config no contienen el valor de la clave.

## Evidencia

| Tarea/caso | Comando, fixture o captura | Resultado y proveedor/modelo |
| --- | --- | --- |
| Transporte fixture | `bun run typecheck`; `bun test tests/llm.test.ts tests/storage.test.ts` | 7 casos: SSE, deltas, calls intercaladas, credencial por endpoint y desconexión parcial. |
| Servidor real | Endpoint default no disponible | El usuario pidió configuración inicial en Models; no se eligió un modelo ni se descargó uno. |

## Cierre

Configuración múltiple y streaming/cancelación con fixtures y servidor local
real. Un protocolo adicional requiere una decisión de alcance independiente.
