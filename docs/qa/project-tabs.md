# QA — Pestañas, menús y open source

Fecha: 2026-10-01. Fuente desde `index.ts`, Linux x64, Bun 1.4.2,
TypeScript 7.0.2. Configuración, proyectos, sesiones y proveedores de prueba
temporales; configuración personal intacta.

## Resultado

- `bun install --frozen-lockfile`: correcto, lock sin cambios.
- `bun run typecheck`: correcto.
- `bun test`: **101 pass, 0 fail**, 20 archivos y 1167 assertions.
- tmux 80×24/60×16: capturas de celdas reconstruidas en RGB e inspeccionadas.
  [Capturas durables](project-tabs-captures.txt): conversación Beta y borrador,
  menú principal Promptings, Tools compacto, ocho pestañas con overflow/Vista.

## Escenarios comprobados

`tests/tabs.test.ts` agrega cinco casos funcionales:

1. Menús de producto sin Componentes/Demo y los siete títulos completos en
   60 columnas. Dos proyectos conservan Unicode, borradores, adjuntos, modo Vim,
   foco y el mismo control de respuesta/scroll al cambiar por mouse/atajos.
   Modales bloquean las pestañas. Reinicio conserva abiertas/activa; cierre
   libera el lock y cerrar todas mantiene el espacio vacío al reabrir.
2. Dos streams SSE de fixture activos simultáneamente, con modelos Alpha/Beta.
   Cada uno muestra su reasoning y escribe `result.txt` solo en su carpeta.
   La finalización de Alpha en segundo plano conserva respuesta, estado y
   borrador de Beta. Ctrl+C cancela Beta; Alpha continúa. Salir cancela Alpha
   y conserva eventos parciales/cancelled, sin locks residuales.
3. Si la segunda sesión está bloqueada por otro proceso, abrir falla y libera
   el lock de la primera; conserva el JSON de configuración. Tras liberar el
   bloqueo, ambos proyectos se restauran.
4. Ocho nombres largos/Unicode en 60×16: rueda, flechas, selección Alt+8,
   clic/release fuera del objetivo, `+` y bloqueo por modal. Quitar una pestaña
   anterior oculta conserva visible la activa. Prompt fijo visible.
5. Proceso real `index.ts` en PTY: abrir Beta mientras Alpha recibe reasoning,
   enviar Beta, volver a Alpha, completar, resize a 60 columnas, recuperar
   borrador Beta y cerrar limpiamente. Reinicio recupera ambos historiales.

Las suites previas se adaptan a Promptings/Tools/Vista y mantienen cobertura de
proveedores, MCP/Skills, paletas, archivos, cancelación y persistencia. El nuevo
tab bar ocupa una fila: el escenario PTY de tools hace scroll para comprobar el
resultado que queda fuera del viewport tras la respuesta final.

## Revisión visual y preparación pública

La captura 80×24 muestra pestañas Alpha/Beta, Beta activa, título centrado y
borrador propio. Promptings ofrece Biblioteca/Nuevo/Guardar prompt actual.
En 60×16 Tools agrupa MCP y Skills; Vista conserva paleta/paneles/Vim, sin
ocultar el prompt. Con ocho proyectos la pestaña activa larga queda accesible
mediante overflow. El auxiliar del menú queda dentro del editor.

MIT, metadata, README, CONTRIBUTING, plantillas y CI fuente están incluidos.
El workflow usa las acciones oficiales checkout/setup-bun y Bun 1.4.2; no
requiere secretos ni inferencia real. YAML y metadata MIT validados localmente.
Revisión de los 127 archivos del índice: sin enlaces locales rotos en Markdown
modificado ni coincidencias de los patrones revisados de tokens/claves privadas.
Solo se exportan archivos indexados, sin .git/config ni archivos locales ajenos.
La exportación limpia del índice ejecuta install frozen, typecheck y
`bun run index.ts --help`, todos con exit 0 y sin dependencias del checkout original.

## Límites de esta evidencia

Los modelos de esta iteración son fixtures locales; no se repite la inferencia
real registrada en [QA GLM](local-llm.md). Mouse SGR inyectado y capturas tmux no
demuestran mouse/drop físico en el emulador del usuario. No se generan binarios,
no se ejecutan Windows/macOS/arm64 ni se vuelve a medir rendimiento/soak.
CI remota y publicación pública siguen pendientes: no se hace push ni release.
`git pull` se intentó y falló porque main no tiene upstream.
