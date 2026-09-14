// Versions share a character identity; version-specific IDs still own stats/panels.
export const operatorFamily = op => op.familyId ?? `${op.side}:${op.name.trim().toUpperCase()}`;
export const versionLabel = op => op.version && op.version !== 'off' ? op.version.toUpperCase() : '';
