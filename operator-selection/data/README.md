# Operator selection data

This directory is reserved for structured data used by the new tab, including
operator metadata, weapon tokens, health and breach values, team selections,
and the Ban & Pick action sequence.

`operators.csv` uses the `side` field to identify each roster entry as
`attack` or `defense`. Alternate entries inherit the side of their base
operator; recruit entries derive it from their `recruit_attack_*` or
`recruit_defense_*` identifier.

## 本机进度保存

选禁、撤回、设置和阵营切换后自动保存到本网站的 localStorage，键为
`six-siege-los:operator-draft:v1`。只保存规则/范围/排序、当前阵营和有序历史，
刷新时通过引擎重放历史，重建头像、状态及完整撤回链。重置删除记录。
存档带格式版本、规则签名和已操作干员的数据签名；不兼容或损坏时要求明确确认后清除，
不会静默覆盖。其他页面修改后提示载入最新记录，保存前再次比较，并在支持时通过 Web Locks 串行写入。
存储被禁用或容量不足时提示不能保存，当前会话仍可继续。没有跨设备同步，也不能抵抗用户清理网站数据。

## 设置与排序模式

齿轮中的规则、范围和排序仅在选禁历史为空时可改，撤回全部操作后重新解锁。
重置恢复标准规则、ALT/DIY 开启、默认“速度/枪械”。三横杠暂不绑定操作。

- `speedWeapon`（速度/枪械）：HP 升序、同 HP 的 RECRUIT 排后，随后总/近/中/远期望伤害依次降序。
- `time`（时间）：`operator-time-order.js` 保存用户两张截图从左至右、从上至下的完整名单，
  进攻/防守各 38 个名字，排除 STRIKER/SENTRY。同名版本依次 OFF、ALT、DIY。
  未匹配的名字放最后，按原始首次出现顺序分组，同名仍按版本排序。所有条件相同保持源顺序。

名单包含尚未录入数据的 RAM、DEIMOS、RAUORA、SOLID SNAKE、TUBARÃO、SKOPÓS、DENARI、NOOR，
仅预留位置，不生成可选干员。匹配忽略大小写、空格及重音，兼容 NØKK/NOKK、JÄGER/JAGER 等。
名称核对来源：https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators
其中截图防守方最后一个为 NOOR：https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/noor

## 期望伤害计算

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
