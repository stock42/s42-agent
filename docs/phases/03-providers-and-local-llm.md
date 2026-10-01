# Fase 03 — Proveedores, modelos y streaming con llama.cpp

Estado: **Completada**. Dependencias: [01](01-terminal-ui.md),
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
- [x] F03-08. Probar endpoints fixture independientes para dos proveedores, con
  defaults distintos, errores HTTP y streams truncados.
- [x] F03-09. Validar streaming/cancelación con `llama-server` y un GGUF real. Anotar
  versiones, modelo, template y contexto; documentar cómo iniciar el servidor.
- [x] F03-10. Repetir el flujo desde el entrypoint Bun. Registrar evidencia, actualizar
  CHANGELOG y hacer el commit de cada tarea completada.
- [x] F03-11. Recibir reasoning_content/reasoning progresivo, exponer snapshots
  de tool calls parciales y conservar razonamiento en desconexión/cancelación.
- [x] F03-12. Precargar llama.cpp/DeepSeek, ofrecer sus plantillas en configuraciones
  previas y consultar el catálogo al configurar; selección explícita, metadata,
  corrección de errores en el formulario y credenciales de sesión sin persistencia.

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
| Dos proveedores / errores | `bun test tests/llm.test.ts` | Endpoints independientes con el mismo model ID y keys diferentes; HTTP 401/404/429/503, idle y cancelación parcial. |
| TUI fuente | `bun test tests/app-terminal.test.ts` | Host/puerto/key configurados desde Models; clave en memoria y fuera de config/sesión. |
| Servidor real | [GLM local](../qa/local-llm.md) | Endpoint del usuario; skill/MCP/read/edit/shell, bun test exit0, reasoning, cancelación y reapertura. |
| Reasoning / calls progresivas | `bun test tests/reasoning.test.ts` | Ambos campos con UTF-8 fragmentado, snapshots independientes, cancelación/reapertura y reasoning conservado en el request siguiente. [QA](../qa/explorer-and-reasoning.md). |
| Presets / catálogo guiado | [QA](../qa/provider-presets.md), [capturas](../qa/provider-presets-captures.txt) | Dos proveedores precargados; lista HTTP fixture, Bearer, metadata, HTTP401/reintento, cancelación, prompt en 60×16 y selección persistente. DeepSeek real no probado sin una clave configurada. |

## Cierre

Configuración múltiple y streaming/cancelación con fixtures y servidor local
real. Un protocolo adicional requiere una decisión de alcance independiente.

Validación real: [GLM-4.7-Flash](../qa/local-llm.md), streaming/reasoning, tools,
cancelación parcial y reapertura; servidor del usuario sin modificar.
