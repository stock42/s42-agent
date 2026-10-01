# Coding real con llama.cpp — 2026-10-01

Endpoint suministrado por el usuario: http://0.0.0.0:8080/v1/models.
Base utilizada http://0.0.0.0:8080/v1. Modelo **GLM-4.7-Flash**, archivo externo
GLM-4.7-Flash-UD-Q4_K_XL.gguf, contexto servidor 32768, salida cliente 4096.
llama-server 0.4.1-dev, build 11056, commit e613ef2c8, GNU13.3.0 Linuxx86_64.
Template y settings devueltos por /props conservados en [JSON](local-llm.json).
No se modificó ni reinició el servidor del usuario.

`bun run scripts/validate-local-llm.ts http://0.0.0.0:8080/v1` trabaja en carpeta
temporal con config aislada, dos archivos y AGENTS.md propio:

```diff
-export function sum(a: number, b: number) { return a - b; }
+export function sum(a: number, b: number) { return a + b; }
```

El modelo invocó read, la herramienta MCP QA/project_hint, edit y shell. La skill
qa-guide se cargó por /skill antes de inferir. Se conservaron 5 pares start/result;
la llamada MCP tuvo un efecto comprobado. El servidor MCP QA es un fixture Bun
de protocolo; la inferencia y las herramientas de coding sí son reales. Shell ejecutó `bun test`: 1 test pasó;
una ejecución independiente también devolvió exit0, manteniendo el test original.
El registro distingue reasoning, contenido final y tools reales.

El segundo turno se canceló después de recibir razonamiento real. El mensaje
parcial se persistió y se encontró al reabrir; no se repitieron herramientas.
Coding y cancelación se comprobaron mediante App fuente; las suites PTY cubren
por separado el entrypoint, teclado y render. Esto no prueba mouse/drop físicos.
El script borra la carpeta temporal al terminar. No se alteró la config personal.
