# QA — Recuperación por etapas, About y skills.sh

2026-10-01. Linux x64 / Bun 1.4.2. Fuente desde index.ts; config/proyectos
temporales. Sin modificar configuración personal ni el servidor LLM.

## Validación automática

Typecheck correcto. Suite: **105 pass / 0 fail**, 21 archivos, 1285 assertions.

`tests/recovery.test.ts` reproduce una tool write realizada antes del corte y
otra call incompleta al terminar por length. La recuperación conserva texto/
reasoning, descarta esa call, solicita dos etapas y realiza una segunda write
válida. No reejecuta la primera ni crea el archivo de la call truncada. El sufijo
de continuación dividido carácter a carácter no aparece en el chat ni en texto
guardado; reabrir conserva las entregas sin requests nuevos. El presupuesto no
cambia y los prompts de control no quedan como mensajes del usuario.

HTTP503, idle y cancelación no disparan recuperación. Repetir length o etapas
sin fin termina por maxSteps y conserva el avance; cancelar detiene la etapa
activa. Después de tools el último mensaje de la siguiente request sigue siendo
su resultado, con una sola instrucción de etapa al comienzo.

`tests/extensions.test.ts` abre About por menú/mouse en 60×16, comprueba versión
de package.json y borrador conservado. El flujo de búsqueda intercepta fetch para
comprobar exactamente https://skills.sh, /api/search, q y limit20, resultados y
Ver origen; no reemplaza esa comprobación por un proveedor LLM.

## GLM real y consulta real del catálogo

[Evidencia JSON](staged-recovery-live.json). GLM-4.7-Flash servido en
http://127.0.0.1:8080/v1. Un proxy local reduce **solo el primer** max_tokens a
64 para provocar length; las siguientes llamadas usan el límite configurado
de 1024. Esta reducción pertenece al escenario QA, no al algoritmo del harness.

Resultado: cuatro requests, primer corte length, guía de etapa1, dos writes
sucesivas y respuesta final. `first.txt` contiene Bun y `second.txt`, QBasic;
estado Listo. El modelo completó ambos archivos dentro de la primera etapa de
recuperación; las dos etapas con indicador de continuación se ejercitan en el
fixture. Duración 5937 ms, incluyendo la consulta de catálogo. No se extrapola
esta tarea breve a todos los tamaños/modelos.

Un primer ensayo reenviaba la guía como último mensaje después de cada tool y
GLM repitió acciones hasta el límite de 8 pasos (9 requests). Se corrigió su
posición: la guía queda al inicio de la etapa y assistant/tool/results conservan
su orden. Repetición corregida finalizó en cuatro requests; el test cubre el
orden y la cantidad de instrucciones para impedir esa regresión del harness.

`searchSkills("react")` consultó directamente https://skills.sh/api/search y
devolvió 20 resultados, con IDs/origen/instalaciones del sitio. No se instala ni
ejecuta una skill en este cambio. La búsqueda usa el mismo endpoint descrito por
el [CLI oficial](https://github.com/vercel-labs/skills/blob/main/src/find.ts).

## TUI

[Capturas tmux](staged-recovery-captures.txt), reconstruidas en RGB e inspeccionadas:

- Recuperación SSE fixture desde index.ts: Etapa1 y Etapa2 visibles, estado Listo,
  parcial conservado en historial, prompt fijo; control interno oculto.
- Ayuda → About a 80×24 y 60×16: Powered by César Casas., MIT., S42 Agent. y
  Version: 0.1.0. Escape/cierre conserva Borrador conservado.
- Búsqueda real desde la TUI en 60×16: formulario del dominio skills.sh,
  resultados reales y prompt visible; cierre devuelve el foco.

La recuperación depende de que el modelo respete las instrucciones de etapas;
un límite de contexto o de pasos se informa conservando el avance. Mouse SGR/
capturas tmux no prueban mouse físico del emulador. Sin builds nuevos ni QA por
otros SO. git pull falló por main sin upstream; cierre en commit local sin push.
