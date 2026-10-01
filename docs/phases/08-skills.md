# Fase 08 — Skills y catálogo skills.sh

Estado: **Completada**. Depende de 02/04.

- [x] F08-01. Cargar SKILL.md con frontmatter YAML nativo de Bun: name,
  description, base directory y cuerpo; error comprensible si es inválido.
- [x] F08-02. Registro local global o por proyecto, listado, lectura, quitar y
  enabled/disabled. No ejecutar scripts al registrar o instalar.
- [x] F08-03. Catálogo resumido en el contexto; carga completa mediante tool skill
  e invocación /skill nombre prompt. Solo skills habilitadas del proyecto/globales.
- [x] F08-04. Tools → Skills (Alt+S), /skills y buscador skills.sh mediante fetch Bun
  a /api/search; mostrar nombre, origen e instalaciones.
- [x] F08-05. Instalación explícita desde repositorios GitHub reconocidos: copiar
  carpeta completa y recursos, conservar licencias, registrar origen y scope.
- [x] F08-06. Probar YAML multilínea, scopes, disabled, carga progresiva, query,
  cancelación, CRUD e invocación en el loop con fixtures.
- [x] F08-07. Buscar e instalar una skill del catálogo real en directorio temporal,
  comprobar origen/carpeta/licencias y limpiar sin tocar skills personales.
- [x] F08-08. Documentar contrato y limitaciones; CHANGELOG y commit.

Instalar requiere Git externo; el harness y el buscador siguen siendo Bun, sin
npm/npx/Node. Un origen del catálogo que no sea owner/repo GitHub muestra su enlace
y permite registro local; no se supone una URL de instalación inexistente.
El catálogo ofrece descubrimiento, no garantiza la calidad de sus instrucciones.

Fuentes: [Agent Skills](https://agentskills.io/specification),
[API usada por el CLI oficial](https://github.com/vercel-labs/skills/blob/main/src/find.ts),
[YAML de Bun](https://bun.sh/docs/runtime/yaml). [QA](../qa/mcp-and-skills.md).

Búsqueda e instalación real: [skills-catalog.json](../qa/skills-catalog.json),
repo oficial vercel-labs/agent-skills, carpeta con reglas preservada y eliminada
tras QA; scripts sin ejecutar. La skill QA del agente se invocó con GLM real.

[Fase 11](11-staged-recovery-and-about.md) vuelve a comprobar la consulta directa
a https://skills.sh y muestra el origen completo en búsqueda/resultados de la TUI.
