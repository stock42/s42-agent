// A single suffix lets the model request the next small stage without exposing
// control text in the chat. Normal completions do not use this protocol.
export const nextStage = "[[S42_CONTINUE]]";

export function stageRequest(stage: number, outputTokens: number): string {
  return `La respuesta anterior alcanzó el límite de salida. Conservá el pedido original y dividilo en etapas pequeñas.
Esta es la etapa ${stage}. ${stage === 1 ? "Mostrá un plan breve y resolvé solo la primera etapa pendiente." : "Resolvé solo la siguiente etapa pendiente, sin repetir el plan."}
Encabezá la respuesta con "Etapa ${stage}". Entregá resultados breves, con razonamiento conciso: el límite de ${outputTokens} tokens incluye razonamiento, texto y argumentos de herramientas.
Usá herramientas para cambiar archivos; si un archivo es grande, escribilo en partes mediante cambios pequeños y exactos. No vuelvas a ejecutar herramientas ya realizadas. Las llamadas truncadas no se ejecutaron.
Si todavía quedan etapas, terminá el texto con ${nextStage}; el harness te pedirá la siguiente. Si ya completaste el pedido, terminá sin ese marcador. No afirmes que completaste trabajo pendiente.`;
}

export function stageReply(text: string): { text: string; more: boolean } {
  const tail = text.trimEnd(), more = tail.endsWith(nextStage);
  if (more) return { text: tail.slice(0, -nextStage.length).trimEnd(), more };
  // Cancellation or length can cut the control suffix itself.
  for (let size = nextStage.length - 1; size >= 3; size--) {
    if (tail.endsWith(nextStage.slice(0, size))) return { text: tail.slice(0, -size).trimEnd(), more: false };
  }
  return { text, more };
}

export function stageStream(emit: (text: string) => void): { push: (text: string) => void; end: () => void } {
  let pending = "";
  return {
    push(text) {
      pending = (pending + text).replaceAll(nextStage, "");
      let suffix = Math.min(pending.length, nextStage.length - 1);
      while (suffix && !nextStage.startsWith(pending.slice(-suffix))) suffix--;
      const ready = pending.slice(0, pending.length - suffix); pending = pending.slice(pending.length - suffix);
      if (ready) emit(ready);
    },
    end() { if (pending && (pending.length < 3 || !nextStage.startsWith(pending))) emit(pending); pending = ""; },
  };
}
