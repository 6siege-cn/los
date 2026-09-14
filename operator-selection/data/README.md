# Operator selection data

This directory is reserved for structured data used by the new tab, including
operator metadata, weapon tokens, health and breach values, team selections,
and the Ban & Pick action sequence.

`operators.csv` uses the `side` field to identify each roster entry as
`attack` or `defense`. Alternate entries inherit the side of their base
operator; recruit entries derive it from their `recruit_attack_*` or
`recruit_defense_*` identifier.

## 期望伤害（内部字段）

`operators.js` 为每个版本独立生成四个数值字段：`closeExpectedDamage`（近）、
`mediumExpectedDamage`（中）、`longExpectedDamage`（远）、`totalExpectedDamage`（前三项之和，不取平均）。
黄骰 = 1，橙骰 = 1.5，红骰 = 2，裂黄/裂橙/裂红骰均 = 0；每个距离按其骰子数组求和。
空数组为 0，未知骰子会报错，避免静默生成错误数据。ALT 使用自身骰子，不继承 OFF 的伤害。
计算函数在 `src/expected-damage.js`，每次 `npm run build-operators` 自动重算，
无需在 CSV 重复维护派生数值。暂不展示，也不计入技能、血量或破坏等级。

## 技能文本格式

每个干员仅有一个 `skill` 文本字段，段落以换行分隔。技能名称或标题备注（如果原文有）
放在首行；不再分开保存名称、段落数组、正文和来源对象。

`operator-skills.json` 是按原版干员 ID 保存的唯一手工维护文本表。
`operators.csv` 继续维护数值和素材字段，`npm run build-operators` 将两份数据合并生成
`operators.js`。ALT 条目按同名、同阵营的 OFF 条目读取完全相同的技能，无需维护第二份文本。

已统一换行并清理段首段尾空白，移除行首多余的 `/`，保留正文中的“门/窗”“和/或”等符号及原文含义。
68 份技能覆盖 68 个 OFF 和 15 个 ALT 条目。4 个新进干员缺少描述，`skill` 为 `null`。

保留原件副本 `sources/r6-operator-skills.doc` 以便重新提取；不再保存另一份原始提取 TXT。
安装开发依赖后可运行 `npm run extract-skills` 和 `npm run build-operators` 重新生成。
标题别名为 `Kapcan → KAPKAN`、`Mirror → MIRA`。提取脚本只规范格式，不执行或改写技能规则。
