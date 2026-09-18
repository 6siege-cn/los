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

`GET /api/health` 检查代码版本；`POST /api/matches` 自动提交；`DELETE /api/matches/:submissionId` 撤回；`GET /api/matches?page=1` 每页 20 局；`GET /api/matches/:id` 公开详情；`GET /api/stats?map=&rule=&type=normal&family=0` 返回统计。写入请求通过 Bearer 提交独立凭据。

提交编号处理重试，按北京时间日期及规范化阵容摘要处理跨用户去重。D1 事务批次及唯一约束保证并发安全，插入触发器只对实际新增记录计费额，删除不退额度。重复提交者不获得原始记录的删除权。删除墓碑防止先撤回、后收到上传时复活。

私人字段不出现在公开接口。统计按干员可选范围计算分母，按被禁干员阵营归类。当前记录较少，统计实时读取有效记录，不使用可能延迟撤回的缓存。数据库增大后应改为增量聚合。

运行 `node --test` 检查服务实际 SQL、权限、额度、并发、统计口径及 IndexedDB 迁移/队列。CI 在部署前运行这些检查。生产数据备份可通过 Cloudflare D1 控制台导出；本期无定时备份及管理后台。
