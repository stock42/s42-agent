# Inteligencia del harness: evidencia y decisiones

Investigación: 2026-10-01. Objetivo: mejorar cómo S42 Agent usa el modelo,
las herramientas y el feedback conservando simplicidad, rapidez y estabilidad.
No modifica los pesos del LLM ni demuestra por sí sola mayor inteligencia.

## Papers consultados

Fuentes primarias: resúmenes de los autores y, para SWE-agent/SkillsBench,
secciones de diseño, ablaciones y evaluación. Las filas separan lo publicado
de nuestra interpretación. Los trabajos recientes de skills son preprints;
sus resultados dependen del modelo, dominio, versiones y protocolo evaluados.

| Paper y versión consultada | Evidencia relevante | Interpretación para S42 |
| --- | --- | --- |
| [ReAct, 2022/ICLR 2023, v3](https://arxiv.org/abs/2210.03629v3) | Alternar razonamiento, acciones y observaciones permite revisar planes y afrontar excepciones; evalúa QA y entornos interactivos. | Conservar el loop herramienta → resultado → decisión. Las observaciones reales deben cambiar la próxima acción; su evidencia no prueba resultados de coding en nuestro modelo. |
| [SWE-agent, 2024, v3](https://arxiv.org/html/2405.15793v3), §§2–3 y 5.1 | El diseño de la interfaz del agente importa: operaciones simples, feedback conciso, búsqueda resumida y edición eficiente. Sus ablaciones muestran desventajas de exploración excesiva y archivos/contextos completos. | read con rangos, find/search diferenciados, edit exacto y resultados con errores/recortes explícitos. Mejorar esas herramientas antes de agregar más capas de planificación. |
| [Reflexion, 2023, v4](https://arxiv.org/abs/2303.11366v4) | Usa feedback lingüístico y memoria episódica para orientar nuevos intentos, sin entrenar pesos. Incluye tareas de coding. | Instruir al agente para revisar hipótesis después de errores. Este cambio no implementa el framework ni su memoria episódica; esas capacidades requieren una tarea y evaluación propias. |
| [Agentless, 2024, v2](https://arxiv.org/abs/2407.01489v2) | Localización, reparación y validación forman un baseline competitivo en SWE-bench Lite con control simple. | La skill de debugging usa localizar → reparar → verificar. Mantener un loop único; no introducir múltiples agentes para cada pedido. |
| [ACE, 2025/ICLR 2026, v3](https://arxiv.org/abs/2510.04618v3) | Contextos como playbooks, con generación/reflexión/curación e incrementos estructurados, buscan evitar pérdida de detalles al reescribir resúmenes. | Una futura memoria debería conservar decisiones, evidencias y pendientes con procedencia. No hay autoaprendizaje ni contexto ACE implementado en esta fase. |
| [SkillsBench, febrero 2026, v1](https://arxiv.org/html/2602.12670v1), §§3.3–4.4 | Reporta +16,2 puntos porcentuales de promedio con skills curadas, +4,5 en software engineering; hay tareas que empeoran. Skills autogeneradas no mejoran en promedio y documentación exhaustiva puede perjudicar. | Catálogo breve y skills específicas cargadas según necesidad. Esas cifras corresponden a sus configuraciones, no a S42 ni a llama.cpp. |
| [SWE-Skills-Bench, marzo 2026, v1](https://arxiv.org/abs/2603.15401v1) | De 49 skills evaluadas, 39 no mejoran el pass rate; promedio +1,2% y overhead de tokens hasta 451%. Hay degradaciones por instrucciones incompatibles con la versión/proyecto. | AGENTS.md y convenciones del proyecto prevalecen sobre guías genéricas. No cargar skills por defecto ni asumir que más texto mejora un agente. |
| [Signal or Noise?, agosto 2026, v1](https://arxiv.org/abs/2608.23067v1) | En desarrollo web, la inyección de skills disminuye el Pass@2 promedio e incrementa costos en las configuraciones estudiadas. Compara además instrucciones irrelevantes de igual longitud. | Evaluar cada combinación skill/proyecto/modelo y el costo de contexto. Una skill apropiada es una hipótesis a comprobar, no una mejora universal. |

## Aplicado en esta fase

`src/agent/prompt.ts` define identidad y procedimiento corto: respetar el pedido
y AGENTS.md, inspeccionar, actuar en etapas verificables, interpretar errores,
revisar la hipótesis y comprobar antes de afirmar éxito. Responde en el idioma
del usuario. Un modelo sin tools recibe instrucciones de conversación y debe
distinguir sugerencias de acciones realizadas.

`src/agent/skills/` contiene tres skills escritas para este harness:

| Nombre | Cuándo cargar | Resultado esperado |
| --- | --- | --- |
| `software-project` | Proyecto nuevo, estructura inicial o arquitectura solicitada. | Alcance, contratos, estructura mínima y etapas con aceptación verificable. |
| `debug-and-verify` | Error reproducible, regresión o validación. | Hipótesis respaldada, reparación pequeña, reproducción/checks y límites de la evidencia. |
| `create-pdf` | Artefacto PDF solicitado. | Markdown/HTML → renderizador instalado → PDF comprobado; limitaciones explícitas si falta render o revisión visual. |

El system prompt incluye solo **nombre y descripción**. `internal_skill({})`
lista el catálogo; `internal_skill({"name":"software-project"})` devuelve su
cuerpo. Cargar instrucciones no ejecuta scripts ni crea archivos. El cuerpo
entra al contexto como resultado de la tool y persiste en el chat/sesión; no se
vuelve a inyectar completo en el system prompt. La relevancia la decide el LLM.
Las imports estáticas de texto incluyen las guías en el programa, sin depender
de la ubicación del checkout. Se validó ejecución desde fuente, no binarios nuevos.

Las skills externas configurables mantienen su mecanismo actual: registro,
scope, enabled/disabled, `/skill nombre pedido`, tool `skill` y skills.sh.
Las internas son guías incluidas con el producto; no se registran en la config
ni reemplazan esas extensiones.

## Tools fundamentales y criterio de elección

| Capacidad | Tools actuales | Motivo |
| --- | --- | --- |
| Entender el repositorio | `list`, `find`, `search`, `read` | Localizar por ruta/contenido y leer rangos relevantes sin volcar todo el proyecto al contexto. |
| Modificar | `write`, `edit` | Crear texto o sustituir una coincidencia exacta. Errores de edición se devuelven al modelo. |
| Verificar y usar programas | `shell` | Tests, typecheck, Git, comandos del sistema y renderizadores instalados; exit/stdout/stderr y cancelación reales. |
| Integraciones HTTP | `fetch` | GET/POST/PUT/PATCH/etc., headers, JSON/forms/texto y errores HTTP observables. |
| Pruebas de servicios en tiempo real | `websocket` **nueva** | Conexión ws/wss finita, headers/subprotocolos, envío/recepción, timeout y cierre. |
| Documentos | `markdown_html` **nueva** | Conversión nativa Bun a fragmento o documento HTML, salida en archivo o preview acotado. |
| Conocimiento procedural | `internal_skill` **nueva**, `skill` externa | Descubrir y cargar solo instrucciones relevantes. |
| Sistemas adicionales | Tools MCP habilitadas | Extender capacidades mediante la configuración existente sin meterlas todas en el núcleo. |

No hace falta duplicar `shell` con una tool por cada comando Git/test. PDF es
una **skill** que compone tools y un renderizador disponible; Bun no imprime
PDF nativamente. WebSocket abre y cierra una conexión por call; no mantiene
sesiones de sockets ni servidores de prueba vivos entre turnos.

## Siguientes mejoras propuestas, sin implementar

1. **Evaluación A/B con el mismo modelo local:** tareas de localizar/editar/
   verificar, proyecto nuevo, debugging, PDF y servicio HTTP/WS. Comparar prompt
   anterior, nuevo prompt sin skills y nuevo prompt con skills. Misma revisión,
   contexto/presupuesto/temperatura, varias repeticiones; medir aceptación por
   ejecución, tokens E/S, latencia, llamadas fallidas y efectos. El fixture
   demuestra integración; no cuantifica mejoras del modelo.
2. **Gestión de contexto:** preservar objetivo, decisiones, archivos cambiados,
   resultados y pendientes cuando el historial crece. El loop actual estima
   tokens y pide `/new` si excede contexto; no compacta automáticamente ni sabe
   la tokenización exacta del proveedor. Diseñar esta mejora después de medir
   tareas largas, sin borrar la evidencia de las tools.
3. **Edición de varios cambios:** considerar `apply_patch` si los intentos con
   `edit` exacto muestran problemas recurrentes. Hoy write/edit/shell cubren
   edición; una herramienta adicional debe justificar menos errores o calls.
4. **Consulta web/documentación:** fetch obtiene una URL conocida, pero no es un
   buscador web. Un buscador requiere elegir proveedor/contrato; un extractor de
   HTML podría ahorrar contexto. No incorporados por inferencia en esta tarea.
5. **Seguridad del contenido externo:** considerar separación explícita de
   instrucciones del usuario/proyecto y material remoto, y sanitización cuando
   HTML externo se abra o publique. `Bun.markdown.html` es un renderer, no un
   sanitizador. Estas políticas se presentan como propuestas para aprobación,
   sin introducir filtros/allowlists nuevos silenciosamente.

## APIs y validación

- [Bun Markdown](https://bun.sh/docs/runtime/markdown): Bun.markdown.html y
  opciones de heading IDs. [Text loader](https://bun.sh/docs/bundler/loaders#text)
  para las guías internas; strings incluidas por imports explícitas.
- [Bun WebSockets, cliente](https://bun.sh/docs/runtime/http/websockets):
  clase WebSocket, ws/wss, headers de Bun y eventos. Tipos instalados de Bun 1.4.2
  verifican protocols/headers y terminate. No dependencias `ws` o Markdown externas.
- [Contratos, ejemplos y límites](TOOLS.md); [QA de esta fase](qa/internal-skills.md).

No se afirma mejora porcentual de S42 con tests funcionales. La evidencia de
papers fundamenta decisiones; una mejora de capacidad real requiere la
evaluación pareada propuesta con nuestros modelos y tareas.
