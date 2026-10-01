# Fase 11 — Recuperación por etapas, About y skills.sh

Estado: **Completada**. Depende de 01/03/04/08/10. Requisitos R04/R14/R19.

- [x] F11-01. Distinguir límite de salida de HTTP, desconexión, timeout y
  cancelación mediante error tipado; preservar texto/reasoning parcial.
- [x] F11-02. Solicitar división en etapas pequeñas al alcanzar el límite,
  continuar cuando queden etapas y mostrar cada entrega en el chat; conservar
  presupuesto, sesión/cwd y resultados previos. Descartar calls truncadas.
- [x] F11-03. Insertar instrucciones al comenzar la etapa y conservar el orden
  assistant/tool/results después; ocultar control fragmentado, respetar maxSteps,
  Ctrl+C y persistencia/reapertura sin replay automático de efectos.
- [x] F11-04. Agregar Ayuda → About con Powered by César Casas., MIT., S42 Agent.
  y versión de package.json; modal legible y prompt visible en terminal compacto.
- [x] F11-05. Verificar búsqueda literal en https://skills.sh usando su API;
  mostrar URL del sitio en búsqueda/resultados y enlace de cada skill.
- [x] F11-06. Validar source/typecheck/tests, GLM real con corte provocado,
  catálogo real y capturas 80×24/60×16; actualizar docs/CHANGELOG y commit local.

| Evidencia | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto |
| `bun test` | 105 tests / 21 archivos / 1285 assertions; cero fallas |
| `tests/recovery.test.ts` | Partial, etapas SSE, calls descartadas, continuidad de tools, cancelación y límites |
| `tests/extensions.test.ts` | About con versión real, borrador visible y consulta al dominio/ruta correctos |
| [GLM/catálogo real](../qa/staged-recovery-live.json) | Corte inicial length, recuperación, dos archivos reales y 20 resultados de react |
| [QA](../qa/staged-recovery.md) / [capturas](../qa/staged-recovery-captures.txt) | Entry point Bun/tmux, About y buscador directo; 80×24 y 60×16 |

Config/proyectos temporales; servidor LLM y configuración personal intactos.
Sin builds nuevos ni mouse/drop físico. Pull fallido por main sin upstream;
commit local, sin push.
