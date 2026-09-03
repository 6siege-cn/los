import { readFileSync } from "node:fs";

import { checkLineOfSight } from "../scripts/los-engine.js";

const cases = JSON.parse(readFileSync(0, "utf8"));
const answers = cases.map((item) =>
  checkLineOfSight({
    map: {
      walls: item.mainWalls,
      redWalls: item.redWalls,
      orangeWalls: item.orangeWalls,
      windows: item.windows,
    },
    blue: item.start,
    orange: item.end,
    brokenWalls: {
      red: new Set(item.brokenWalls.red),
      orange: new Set(item.brokenWalls.orange),
      windows: new Set(item.brokenWalls.windows),
    },
    smokes: item.smokes,
    lineThickness: item.lineThickness,
  }).hasLineOfSight,
);
process.stdout.write(JSON.stringify(answers));
