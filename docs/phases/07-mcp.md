# Fase 07 — Model Context Protocol

Estado: **Completada en el alcance tools**. Depende de 02/03/04.

- [x] F07-01. Configuración versionada de servidores: CRUD, enabled/disabled,
  stdio (command/args/cwd/envRefs) y Streamable HTTP (URL/API key env).
- [x] F07-02. Cliente Bun sin dependencias runtime: JSON-RPC, stdio NDJSON,
  HTTP JSON/SSE, descubrimiento 2026-07-28 y negociación legacy 2025-11-25,
  2025-06-18, 2025-03-26 y 2024-11-05.
- [x] F07-03. tools/list paginado, nombres únicos, schemas y tools/call;
  integrar al loop con herramientas nativas y mensajes persistidos.
- [x] F07-04. Progreso, errores e inicio/resultados visibles; cancelación, timeout,
  cierre de conexiones y procesos; servidor disabled no inicia ni hace requests.
- [x] F07-05. Menú MCP (Alt+C), /mcp y prueba de conexión; formularios compactos,
  sin tapar el prompt ni chocar con Skills/Ayuda a 60×16.
- [x] F07-06. Validar RPC HTTP/stdio, headers, sesiones legacy, error/auth,
  paginación, nombres únicos, efectos y reanudación sin reejecución.
- [x] F07-07. Documentar contrato, límites y evidencia; CHANGELOG y commit.

## Evidencia

`tests/mcp.test.ts` cubre modernos JSON/SSE y stdio legacy, cancelación HTTP,
headers Unicode, paginación, auth/session/DELETE y descendientes Linux.
`tests/extensions.test.ts` cubre CRUD y el loop completo MCP+skill, persistencia
nombrada y reapertura sin repetir efectos. Typecheck correcto.

El cliente implementa el alcance solicitado de herramientas; no anuncia sampling,
elicitation ni OAuth, ni administración de resources/prompts. No afirmar que
implementa todas las capacidades opcionales de MCP. Las conexiones se abren por
turno y se cierran al finalizar/cancelar; una tool con efectos no se reintenta
silenciosamente ante pérdida de conexión. Windows taskkill implementado, runtime
Windows pendiente. Ver [QA](../qa/mcp-and-skills.md).

Fuentes: [MCP actual](https://modelcontextprotocol.io/specification/2026-07-28),
[stdio](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio),
[HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http),
[legacy](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
