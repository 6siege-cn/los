# 国内连接中转：第一阶段

本目录中的 Worker 目前只开放 `GET /api/relay-health`。它用于验证中国大陆网络能否通过 `6siege-cnapi.icemoe.moe` 连接现有 API，不提供上传、撤回或管理员操作，也不会读写 D1。

由另一个大模型代理执行朋友账号中的部署时，使用 [`AGENT_HANDOFF.md`](./AGENT_HANDOFF.md) 作为完整交接与权限边界，不要让其自行推断 DNS 操作。

## 域名所有者部署步骤

1. 登录管理 `icemoe.moe` 的 Cloudflare 账号。
2. 进入 **Workers & Pages**，选择 **Create**，创建一个 Hello World Worker。
3. Worker 名称填写 `six-siege-cn-relay`。
4. 打开在线代码编辑器，用 [`worker.js`](./worker.js) 的完整内容替换示例代码，然后选择 **Deploy**。
5. 进入该 Worker 的 **Settings > Domains & Routes**。
6. 选择 **Add > Custom Domain**，填写 `6siege-cnapi.icemoe.moe` 并确认。
7. 等待 Cloudflare 显示域名和证书为可用状态。

不要提前添加 A、AAAA、CNAME 或 NS 记录。Custom Domain 会自动创建所需 DNS 记录和 HTTPS 证书；它不会修改主域名、`www` 或邮件记录。

第一阶段不需要配置变量或密钥，也不要开启日志持久化。

如果以后使用命令行部署，必须明确指定本目录的 `wrangler.jsonc`，避免误用主 API 的 D1 配置；第一次建议仍按上面的网页步骤操作。

## 人工验收

关闭代理后，在浏览器打开：

```text
https://6siege-cnapi.icemoe.moe/api/relay-health
```

正常结果应包含：

```json
{"ok":true,"relay":"ready","relayVersion":1,"upstream":"ready","upstreamVersion":3}
```

只以中国大陆无代理环境的人工结果作为阶段验收依据。本地测试或代理环境测试不能代替该验收。

## 回滚

如连接不稳定，在 Worker 的 **Settings > Domains & Routes** 中删除该 Custom Domain，再删除 `six-siege-cn-relay` Worker 即可。删除操作不会影响 `icemoe.moe` 的其他解析记录。
