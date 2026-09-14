# 干员选择

- 标准规则在 src/rules.js 中定义；actions 描述己方选用和敌方禁用，rounds 单独排列顺序与次数。新增规则后在 src/config.js 的 settings.rule 中选择。
- 每轮 actions 表示配额，不表示操作先后。同轮可以先禁后选，也可在多次选用之间禁用；全部配额完成后才进入下一轮。阵营标签允许自由切换，只有当前轮仍有配额的操作可执行。撤回按实际点击顺序恢复配额。
- src/engine.js 保存全局操作历史，所有阵容与禁用结果由历史推导。每次撤回删除最后一条操作，支持从完成状态一直回到初始状态。
- 禁用栏属于执行禁用的一方，栏内显示敌方头像。相同阵营与名称的干员共享选禁限制：禁用覆盖所有版本，选用后其他版本锁定。历史仍保存实际版本 ID，信息卡与面板使用所选版本的数据；撤回解除整组限制。identity.js 集中定义身份与版本标识，非 off 版本在矩阵和已选头像左下角显示版本名。
- src/config.js 集中定义素材目录、图标路径、180 度方向修正、颜色与规则配置。avatar、panel 文件名来自 CSV。
- data/operators.csv 是 UTF-8 数据源。修改后运行 node scripts/build-operators.mjs 更新浏览器数据。data/operators.original-gbk.csv 保留迁移前原件。
- 近、中、远距离各为最多四个骰子的列表；hp 和 destruction 为单素材键。assets/tokens 中的英文名与 CSV 键对应。原素材来自 C:/Users/Rainl/Downloads/图标素材，原件未修改。
- 点击已选头像可打开对应 CSV 面板。底部撤回按钮撤销选用时，整张信息卡恢复空白。
- 当前是浏览器内会话；刷新页面重新开始。通过静态 HTTP 服务运行，浏览器不支持直接通过 file 协议加载 ES 模块。
