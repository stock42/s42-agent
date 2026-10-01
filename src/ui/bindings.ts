export const actions = ['projects','models','providers','sessions','attachments','explorer','mcp','skills','help'] as const;
export type Action = typeof actions[number];
export type Bindings = Partial<Record<'global'|'normal',Partial<Record<Action,string>>>>;
export const defaultBindings: Record<'global'|'normal',Partial<Record<Action,string>>> = {
  global:{projects:'ctrl+p',models:'ctrl+o',providers:'ctrl+b',sessions:'ctrl+r',attachments:'ctrl+f',explorer:'ctrl+e',mcp:'alt+c',skills:'alt+s',help:'alt+y'},
  normal:{projects:'leader+p',models:'leader+m',sessions:'leader+s',attachments:'leader+f',explorer:'leader+e',mcp:'leader+c',skills:'leader+k',help:'leader+?'},
};
export function bindings(config: Bindings = {}) {
  const resolved = {global:{...defaultBindings.global,...config.global},normal:{...defaultBindings.normal,...config.normal}};
  if (Object.keys(config).some(c=>c!=='global' && c!=='normal')) throw new Error('Contexto de bindings desconocido');
  for (const context of ['global','normal'] as const) {
    const seen=new Set<string>();
    for (const [action,key] of Object.entries(resolved[context])) {
      if (!actions.includes(action as Action) || typeof key !== 'string' || !(context==='global'? /^(ctrl|alt)\+[a-z]$/:/^leader\+[a-z?]$/).test(key)
        || ['ctrl+c','ctrl+q','ctrl+n','ctrl+w','ctrl+j','ctrl+a'].includes(key)) throw new Error(`Binding inválido: ${context}.${action}`);
      if (seen.has(key)) throw new Error(`Colisión de binding en ${context}: ${key}`); seen.add(key);
    }
  }
  return resolved;
}
