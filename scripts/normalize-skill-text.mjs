// Remove only extraneous leading slashes, not meaningful in-sentence separators.
export const normalizeSkillText=text=>text.replace(/\r\n?/g,'\n').split('\n')
  .map(line=>line.trim().replace(/^\/+\s*/,''))
  .filter(Boolean).join('\n');
