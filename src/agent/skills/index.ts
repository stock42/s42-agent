import softwareProject from "./software-project/SKILL.md" with { type: "text" };
import debugAndVerify from "./debug-and-verify/SKILL.md" with { type: "text" };
import createPdf from "./create-pdf/SKILL.md" with { type: "text" };

// Static text imports keep built-ins available without a source checkout.
export const internalSkills = [softwareProject, debugAndVerify, createPdf].map(source => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) throw new Error("Internal skill is missing frontmatter");
  const metadata = Bun.YAML.parse(match[1]!) as { name: string; description: string };
  return { name: metadata.name, description: metadata.description, body: source.slice(match[0].length).trim() };
});

export const internalSkillCatalog = internalSkills.map(({ name, description }) => ({ name, description }));
