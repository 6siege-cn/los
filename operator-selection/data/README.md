# Operator selection data

This directory is reserved for structured data used by the new tab, including
operator metadata, weapon tokens, health and breach values, team selections,
and the Ban & Pick action sequence.

`operators.csv` uses the `side` field to identify each roster entry as
`attack` or `defense`. Alternate entries inherit the side of their base
operator; recruit entries derive it from their `recruit_attack_*` or
`recruit_defense_*` identifier.

## 技能描述

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
