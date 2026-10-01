# Fase 00 — Base Bun y primer ejecutable

Estado: **Pendiente**. Dependencia: [SPECS.md](../SPECS.md).
Requisitos: R01, R02, R13, R14.

## Objetivo

Establecer una base TypeScript/Bun reproducible y comprobar que el entrypoint
puede convertirse en un ejecutable antes de incorporar la TUI o un proveedor.

## Tareas

- [ ] F00-01. Revisar el scaffold existente, `CLAUDE.md`, package, lockfile y
  tsconfig. Conservar los archivos del usuario; no reinicializar el repositorio.
- [ ] F00-02. Fijar la versión Bun de referencia a partir de la instalada y
  versiones de las dependencias de desarrollo; reproducir `bun install
  --frozen-lockfile`. Mantener un solo paquete y cero dependencias de runtime.
- [ ] F00-03. Crear `src/cli.ts` y un arranque mínimo con `--help` y `--version`;
  parsear argumentos con APIs incluidas en Bun. No implementar modo web o RPC.
- [ ] F00-04. Crear scripts Bun para `dev`, `typecheck`, `test` y `build`. El
  typecheck debe invocar TypeScript mediante Bun y no asumir que `bun build`
  comprueba tipos.
- [ ] F00-05. Registrar la política existente de entorno en desarrollo y build.
  No crear `.env.local` ni cambiar autoload sin aprobar la propuesta de SPECS §15.
- [ ] F00-06. Compilar el primer binario Linux x64 con `bun build --compile`.
  Ejecutar ayuda y versión desde otra carpeta sin acceder a archivos del checkout.
- [ ] F00-07. Comprobar en un entorno de destino que el binario corre sin Bun ni
  Node instalados. Declarar por separado el smoke fuera del checkout y esta prueba.
- [ ] F00-08. Reemplazar el README de scaffold cuando corresponda por instrucciones
  reales. Actualizar esta fase y CHANGELOG; revisar y hacer commit de la tarea.

## Escenarios de aceptación

1. Instalación con lock congelado, typecheck y build terminan correctamente con
   las versiones declaradas. El runtime no introduce paquetes nativos.
2. `--help` enumera únicamente opciones existentes; `--version` coincide con el
   artefacto. Argumentos inválidos reciben error y exit code distinto de cero.
3. Copiar el binario a una carpeta temporal y ejecutar ayuda/versión funciona sin
   `src`, `node_modules` o configuración del checkout.
4. Repetir el smoke en un destino sin Bun/Node. Guardar la comprobación del entorno.
5. Los archivos privados de entorno y claves no aparecen como assets del build.

No agregar tests vacíos para que `bun test` parezca exitoso. Si todavía no hay
comportamiento que requiera un test, registrar el smoke y la ausencia de suite.

## Evidencia

| Tarea/caso | Comando o artefacto | Resultado y entorno |
| --- | --- | --- |
| — | — | Pendiente; no ejecutado. |

## Cierre

Completar la fase cuando la CLI y el binario mínimo funcionen, las versiones y
comandos sean reproducibles y la documentación coincida con ellos.
