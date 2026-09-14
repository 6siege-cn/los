# 干员数据核对记录

来源：`C:/Users/Rainl/Downloads/干员概览 (1).xlsx`，工作表 `Details`。

## 读取方式

- A 列包含阵营编号、干员名称与版本；`-alt` 和 `- alt` 均对应 alt。兼容 Capitão / CAPITAO、Nøkk / NOKK、Jaeger / JAGER。
- B–D 列的绿色标记分别对应 4、5、6 血量（表头为 4-5、5-2、6-0）。
- I–L、N–Q、S–V 分别为近、中、远距离的四个骰子位。黄、橙、红填色表示骰子颜色，`/` 表示裂骰，`.` 表示空位。
- 实色行读取前景色；带 gray125 底纹的行读取背景色，避免漏掉隔行数据。
- F 列破坏等级按用户确认的填表约定解析：未标色为黄色，橙色标记为橙色。
- H、M、R 是汇总数值，不作为骰子数量读取。Storage 是收纳位置表，不用于修改战斗属性。

## 已修正

| 干员 | 字段 | 原值 | 修正值 | Details 单元格 |
| --- | --- | --- | --- | --- |
| DOKKAEBI off | long | yellow_dice, yellow_dice, red_dice, red_dice | broken_yellow_dice, yellow_dice, red_dice, red_dice | S27:V27 |
| ZERO alt | hp | health_5 | health_6 | B42:D42 |
| ZERO alt | close | yellow_dice, yellow_dice, red_dice, red_dice | broken_orange_dice, red_dice, red_dice | I42:L42 |
| TACHANKA alt | close | broken_yellow_dice, orange_dice, red_dice, red_dice | broken_yellow_dice, broken_orange_dice, red_dice, red_dice | I59:L59 |
| MELUSI alt | hp | health_5 | health_4 | B82:D82 |
| SLEDGE alt | destruction | orange_destruction | yellow_destruction | F12 |
| HIBANA alt | destruction | orange_destruction | yellow_destruction | F19 |
| THUNDERBIRD off | destruction | orange_destruction | yellow_destruction | F60 |

## 覆盖范围与未判定项

共匹配 75 条记录，核对 75 个血量值、225 组距离骰子，以及全部 75 个破坏等级。累计修正 7 条干员记录的 8 个字段。

破坏等级含 47 个未标色格（黄色）与 28 个橙色标记格（橙色），已全部复核。

表中未包含以下 12 条记录，保留项目现值：

- `recruit_attack_1`
- `recruit_attack_2`
- `recruit_defense_1`
- `recruit_defense_2`
- `azami`
- `brava`
- `fenrir`
- `grim`
- `osa`
- `sens`
- `solis`
- `thorn`

复核脚本 `scripts/audit-operator-workbook.py` 只读解析原工作簿，并与项目 CSV 比较。CSV 更新后通过 `scripts/build-operators.mjs` 同步浏览器数据，页面和数据模块引用已更新版本号。
