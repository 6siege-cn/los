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

公开列表及详情不缓存，成功撤回后立即不可读取；汇总统计和已缓存的图表存在延迟，正常情况下重新进入页面约 1～1.5 小时内看到变化。快照展示生成及核对时间。免费额度并非无限，规模扩大后需监测 D1 读行和 Worker 用量，再考虑增量聚合。

本地预览运行 `node scripts/dev-community.mjs`，只使用 `.wrangler/community-local.sqlite`。本地专用 `POST /api/local/rebuild` 可立即发布测试快照，生产没有此入口。真实 Worker 集成测试先应用本地迁移，再用 `wrangler dev --test-scheduled --config cloud/wrangler.jsonc --port 8790` 启动，执行 `node scripts/check-community-api.mjs`。

运行 `node --test` 检查服务实际 SQL、权限、额度、并发、统计口径及 IndexedDB 迁移/队列。CI 在部署前运行这些检查。生产数据备份可通过 Cloudflare D1 控制台导出；本期无定时备份及管理后台。
