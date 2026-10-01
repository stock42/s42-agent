# MCP y skills — 2026-10-01

Implementación Bun 1.4.2, sin dependencias de runtime agregadas.

- `bun run typecheck`: correcto.
- `bun test tests/mcp.test.ts tests/skills.test.ts`: 6 casos, 33 assertions.
- `bun test tests/extensions.test.ts`: 2 casos, 18 assertions.
- Suite anterior ampliada: 77 casos, 708 assertions; incluye PTY, cancelación,
  reasoning y reanudación. Suite final se repite luego de todas las fases.

CRUD MCP conserva transport/args/cwd/envRefs/URL/API-key-env y enabled. No escribe
claves reales; hereda el entorno o mapea nombres de variables existentes.
MCP disabled se excluye antes de spawn/fetch. Un nombre de tool duplicado entre
servidores recibe namespace estable distinto, preservado en call/result.
El fixture HTTP moderno envía progreso por SSE; se persiste como notice y aparece
en el chat. El fixture stdio legacy negocia initialize/initialized. Otro caso
valida cancel notification, session ID y DELETE en HTTP legacy. Error 401 no se
convierte en negociación legacy. El cierre mata descendientes comprobados Linux.

El formulario MCP y las skills se prueban con eventos del Desktop a 60×16:
CRUD, toggle, scope del proyecto, respuesta read-only y prompt visible. No equivale
a interacción física con el terminal gráfico.

Skills usa frontmatter YAML real (incluido description multilínea), catálogos
resumidos y body cargado bajo demanda. /skill carga instrucciones antes de inferir;
las tools muestran su carga en el chat. Reapertura conserva la llamada MCP y su
resultado, sin repetir su efecto. Las rutas de scripts se resuelven contra la
carpeta de la skill; instalar/cargar no ejecuta esos scripts.

Errores del catálogo, cancelación y orígenes no GitHub tienen mensajes explícitos.
Búsqueda/instalación real en [skills-catalog.json](skills-catalog.json), con
recursos preservados en carpeta temporal. MCP+skill y edición/verificación con
GLM real: [QA](local-llm.md).

Catálogo real: web-design-guidelines instaló correctamente; vercel-react-best-
practices expuso un alias (name vercel-react-best-practices, carpeta react-best-
practices). El instalador ahora identifica por metadata y normaliza la carpeta
de destino al name. Nueva prueba real pasó y conservó rules/AGENTS.md/README.md.
El registro local sigue comprobando name/carpeta según la especificación.

Models a 60×16: popup/sombra dentro del editor, scroll con flechas/páginas/rueda
e indicadores de continuidad. Prueba de regresión conserva todas las filas del
prompt mientras se recorre el menú completo.
