# QA — Idioma y razonamiento

Fecha: 2026-10-01. Validación desde fuente Bun 1.4.2 / TypeScript 7.0.2.
Configuración, proyectos y sesiones temporales; configuración personal conservada.

| Comprobación | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto |
| `bun test` | 117 pass / 0 fail, 24 archivos, 1519 assertions |
| Config v1 | Campos ausentes migran es/true en memoria; valores inválidos no sobrescriben archivo |
| Language teclado/mouse | Español → inglés → español, marca actual/Escape, menú repintado y hit boxes correctos |
| Formularios | Proyectos, modelos/proveedores, MCP, skills, promptings/metavariables y explorador en inglés |
| CRUD en inglés | Enable MCP conserva ID de acción; capacidades yes/yes y skill scope project guardan datos válidos |
| Contenido original | Nombre Vista, archivo Ayuda con texto Guardar/Archivo y prompting Guardar con valor Enviar permanecen literales |
| Reasoning on/off | Historial con ambos campos, deltas parciales, reactivación sin headers duplicados y todas las pestañas |
| Tools/turno | Calls parciales/ejecución/resultados visibles con off; contexto conserva reasoning recibido |
| Cancelación/reapertura | Respuesta y razonamiento parcial guardados; off respeta lo oculto al reabrir; on recupera el contenido |
| Fallo de guardado | Preferencia/visualización anterior intactas |
| Terminal real | index.ts en tmux 100×30 y 60×16, idioma/menu/formulario/explorador, borrador Unicode y reapertura `--no-color` |

[Capturas del terminal](language-reasoning-captures.txt): nueve pantallas reales,
con Español/on, English/on, English/off, selector y formulario Models, búsqueda
fuera del proyecto y layout compacto. Render ANSI a PNG para inspección visual
local de menú inglés, explorador 60×16 y reapertura sin color. Menús/auxiliares
mantienen prompt fijo visible; idioma no altera mensajes originales del fixture.

El stream de tests/terminal es un fixture SSE local. No es evidencia de otro
proveedor ni mouse físico; tests de mouse usan eventos inyectados. No hubo builds,
publicación ni cambios de drivers. Git pull falló por main sin upstream; commit
local sin push. Cambios previos en docs/qa/final-validation.md y CLAUDE.md excluidos.
