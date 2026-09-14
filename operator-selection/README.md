# Operator Selection

Rainbow Six Siege operator Ban & Pick tab with side-specific lists, standard
rules, selected operator details and global multi-step undo.

## Directory layout

- `docs/` — approved layout and interaction specifications.
- `assets/icons/` — app-ready UI icons with stable filenames.
- `assets/operators/` — operator portraits and operator-specific artwork.
- `data/` — operator, weapon, team, and Ban & Pick flow data.
- `../styles/operator-selection.css` — tab-specific framework styles.
- `src/` — reserved for future interaction code.
- `tests/` — checks for layout constraints and interaction behavior.

## Source material

- Layout specification: `C:\g\tts\six-siege-los\operator-selection\docs\UI_LAYOUT_SPEC.md`
- Original UI icon export: `C:\g\tts\assets\r6-game-extracted\selected-ui-icons\`

The source material remains in place. Copies in this directory are the working
files for the new tab, so the original exports are not modified.

## Preview

Open `/operator-selection/index.html` through the local project server or use
the `干员选择` tab in the main navigation. See
`docs/IMPLEMENTATION.md` for rule extension, asset configuration and CSV updates.
