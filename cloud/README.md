# 社区对局服务

GitHub Pages 提供界面，Cloudflare Worker 提供 API，D1 保存对局。无需 Turnstile 或用户账户。

## 部署

在仓库根目录安装依赖后：

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 migrations apply six-siege-matches --remote --config cloud/wrangler.jsonc
pnpm exec wrangler secret put IP_HASH_SALT --config cloud/wrangler.jsonc
pnpm exec wrangler deploy --config cloud/wrangler.jsonc
```

`IP_HASH_SALT` 使用随机秘密，不能写入仓库。前端 API 地址位于 `operator-selection/src/match-sync.js`。CORS 允许 GitHub Pages 的来源，不使用 Cookie。每条记录的独立随机删除凭据仅留浏览器，服务端只保存摘要。请求体上限 32 KiB。

`GET /api/health` 检查代码版本；`POST /api/matches` 自动提交；`DELETE /api/matches/:submissionId` 撤回；`GET /api/matches?page=1` 每页 20 局；`GET /api/matches/:id` 公开详情；`GET /api/stats-snapshot` 返回完整聚合快照；兼容接口 `GET /api/stats?map=&rule=&type=normal&family=0` 从相同快照计算统计。写入请求通过 Bearer 提交独立凭据。

提交编号处理重试，按北京时间日期及规范化阵容摘要处理跨用户去重。D1 事务批次及唯一约束保证并发安全，插入触发器只对实际新增记录计费额，删除不退额度。重复提交者不获得原始记录的删除权。删除墓碑防止先撤回、后收到上传时复活。

私人字段不出现在公开接口。统计按干员可选范围计算分母，按被禁干员阵营归类。`statistics/` 为独立统计页，首页用进攻、防守徽标散点图展示出场率和胜率。平均线只针对当前可见且有出场的干员计算算术平均值；同名版本先合并计数再计算比例。

## 更新与缓存

Cloudflare Cron 每小时整点执行一次。新增和撤回触发数据修订号变更；定时任务只在修订号有变化时，使用 SQL 聚合生成快照。聚合结果按地图、规则、模式、对局类型和干员范围分桶存入 D1，每桶独立一行；生成过程是事务，失败保留上次快照。没有变化时只更新核对时间。迁移会为已有记录生成初始快照。

页面请求只读取快照，绝不扫描原始对局。边缘缓存 5 分钟，浏览器缓存 30 分钟，并通过浏览器锁合并多标签页请求。手动「检查更新」有 5 分钟冷却，只获取已发布快照，不触发重新汇总。筛选、图表切换、详细统计分页均在浏览器内处理，不轮询、不定时请求。联网失败时保留旧快照并提示；持续打开的页面保持当前结果直到主动检查或重新进入。

管理员账户通过 Worker 加密密钥 `ADMIN_ACCOUNTS` 配置，只保存带 32 字节随机盐的 SHA-256 摘要，不写入代码、数据库或网页。公开对局页底部的无提示密码框根据密码识别管理员身份并进入管理模式；管理员可更正对局元数据或删除任意公开记录。密码只保存在当前页面内存，刷新即退出。编辑和删除都会推进统计修订号，下一次定时汇总后生效。

公开列表及详情不缓存，成功撤回后立即不可读取；汇总统计和已缓存的图表存在延迟，正常情况下重新进入页面约 1～1.5 小时内看到变化。快照展示生成及核对时间。免费额度并非无限，规模扩大后需监测 D1 读行和 Worker 用量，再考虑增量聚合。

本地预览运行 `node scripts/dev-community.mjs`，只使用 `.wrangler/community-local.sqlite`。本地专用 `POST /api/local/rebuild` 可立即发布测试快照，生产没有此入口。真实 Worker 集成测试先应用本地迁移，再用 `wrangler dev --test-scheduled --config cloud/wrangler.jsonc --port 8790` 启动，执行 `node scripts/check-community-api.mjs`。

运行 `node --test` 检查服务实际 SQL、权限、额度、并发、统计口径及 IndexedDB 迁移/队列。CI 在部署前运行这些检查。生产数据备份可通过 Cloudflare D1 控制台导出；本期无定时备份及管理后台。

## 管理员导入旧表格

1. `python scripts/read-match-xlsx.py 对局日志.xlsx .wrangler/history-source.json` 只读取原表单元格，兼容非标准样式，不修改源文件。
2. `node scripts/prepare-history-import.mjs 对局日志.xlsx .wrangler/history-source.json .wrangler/history-import-YYYYMMDD` 生成核对报告、导入 SQL、撤回 SQL 和管理凭据。输出强制留在忽略目录；不得提交或发布原始数据、SQL、凭据。
3. 审核 `audit.md`，在单独本地数据库执行两次 `import.sql`，核对记录数、胜负、规则、阵容和快照。先应用全部迁移。可用 `node scripts/dev-community.mjs .wrangler/history-preview.sqlite` 预览。
4. 导出远程备份，再通过 `wrangler d1 execute six-siege-matches --remote --config cloud/wrangler.jsonc --file <import.sql>` 导入；文件末尾会发布更新快照。备份和导入材料均仅保存在 `.wrangler/`。

导入通过管理员数据库权限执行，公开提交端点仍严格校验网页选禁规则、独立凭据及 IP 额度。历史记录保存为独立来源的版本 3，不伪造网页选禁过程。昵称、备注继续留在私人字段。日期明确时按原日期与规范化阵容去重；日期不明时只合并来源内容相同的记录，不猜测日期。稳定提交编号与唯一约束防止重复执行增加统计。被撤回的导入记录不会因重新执行而复活。

5b / 5ban 识别为 5ban；未注明时，双方各 5 个禁用识别为 5ban，各 2 个识别为标准规则，其余标为历史规则未确认。禁用列表示被禁方，转换为网站的执行方字段。教学（含萌新、推新）、测试、封盘、数据不足、未完成阵容、未知地图、重复干员、阵营错误和不对称禁用被排除。普通操作失误与运气不作为排除依据。未知干员必须有显式历史字典映射，不能任意拼接目录或冒充当前版本。

快照版本 2 增加历史来源、禁用完整性两个分桶维度。历史范围未知，历史出场频率以所选历史局数计算，并在界面说明；网页记录仍按可参与范围。历史独立干员不会进入网页对局分母。禁用率只以有禁用记录的样本为分母；选中存在禁用缺失的对局时，BP率显示为不可用。完整汇总与未知模式、历史规则可分别筛选。

撤回时审核对应批次的 `rollback.sql` 再执行；它只撤回该管理凭据和源文件摘要匹配的记录，并发布新快照。保留最少墓碑防重，不波及网页用户或其他批次。
