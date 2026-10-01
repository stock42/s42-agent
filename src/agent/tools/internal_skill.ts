import { internalSkillCatalog, internalSkills } from "../skills/index.ts";
import { definition, string, type NativeTool } from "./shared.ts";

export const internalSkill: NativeTool = {
  definition: definition("internal_skill", "List built-in skills, or load one by name when relevant. Guidance only; does not execute scripts. Available: software-project, debug-and-verify, create-pdf.", { name: string }, []),
  async run(args, { signal }) {
    signal.throwIfAborted();
    if (args.name === undefined) return { output: JSON.stringify({ skills: internalSkillCatalog }), failed: false };
    const skill = internalSkills.find(skill => skill.name === args.name);
    if (!skill) throw new Error(`Skill interna desconocida: ${String(args.name)}`);
    return { output: `Internal skill: ${skill.name}\n${skill.description}\n\n${skill.body}`, failed: false };
  },
};
