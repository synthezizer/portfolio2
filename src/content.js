// Site content, edited through Decap CMS (/admin) and stored as JSON in /content.
// Vite bundles it at build time, so a CMS save shows up on the next deploy
// (and instantly in dev).
import contact from "../content/contact.json";

const projectFiles = import.meta.glob("../content/projects/*.json", { eager: true, import: "default" });

export const projects = Object.values(projectFiles).sort(
  (a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0)
);

export { contact };
