# `6siege-cnapi.icemoe.moe` 第一阶段部署交接

本文面向管理 `icemoe.moe` 的朋友及其大模型代理。执行者应严格按本文操作，不得自行扩大范围。

## 1. 目标与验收边界

本阶段仅验证以下链路是否可以建立：

```text
中国大陆用户
  -> https://6siege-cnapi.icemoe.moe/api/relay-health
  -> 朋友 Cloudflare 账号中的中转 Worker
  -> https://six-siege-api.rainlef.workers.dev/api/health
```

本阶段不开放对局上传、撤回、管理员操作，不切换正式网页，不读写数据库。

自动化测试、Cloudflare 后台测试以及代理网络测试都不能代替最终验收。只有项目所有者在中国大陆关闭代理后的人工访问结果，才能决定是否进入下一阶段。

## 2. 已知环境

- 主域名：`icemoe.moe`
- DNS 托管：Cloudflare
- 当前名称服务器：`kiki.ns.cloudflare.com`、`donald.ns.cloudflare.com`
- 主域名和 `www` 已有网站解析
- 主域名已有邮件解析记录
- 目标二级域名：`6siege-cnapi.icemoe.moe`
- 目标名称已由域名所有者确认未占用
- 目标 Worker 名称：`six-siege-cn-relay`
- 现有 API：`https://six-siege-api.rainlef.workers.dev`
- 允许跨域调用的网页来源：`https://6siege-cn.github.io`

## 3. 授权操作

执行者仅被授权完成以下操作：

1. 在管理 `icemoe.moe` 的同一个 Cloudflare 账号中创建 `six-siege-cn-relay` Worker。
2. 将指定源码完整部署到该 Worker。
3. 在 Worker 的 Domains & Routes 中添加 Custom Domain `6siege-cnapi.icemoe.moe`。
4. 查看 Cloudflare 自动生成的 DNS 记录和证书状态。
5. 对健康检查和未开放路径进行只读验证。
6. 报告结果，不报告或输出任何账号秘密。

## 4. 禁止操作

执行者不得：

- 修改 `icemoe.moe`、`www.icemoe.moe` 或任何已有解析；
- 修改或删除 MX、SPF、DKIM、DMARC 等邮件记录；
- 修改名称服务器；
- 手动创建 A、AAAA、CNAME 或 NS 记录；
- 删除发生冲突的现有 DNS 记录；
- 将整个域名移动到其他 Cloudflare 账号；
- 为 Worker 绑定 D1、KV、R2、队列或其他资源；
- 创建环境变量或密钥；
- 开启日志持久化或将请求内容写入日志；
- 添加上传、撤回、管理员或通用反向代理路径；
- 修改 GitHub Pages 前端 API 地址；
- 因自己的测试成功而宣称中国大陆连接已验收。

如果界面提示 DNS 冲突、域名不属于当前区域、需要删除现有记录、需要升级付费计划，或需要执行本文未授权的操作，立即停止并报告原始提示，不要尝试绕过。

## 5. 部署源码

必须使用以下固定版本：

- 源码：[cloud/relay/worker.js](https://github.com/6siege-cn/los/blob/0294824b7578160ddcc043bf0f0921e6bee81a93/cloud/relay/worker.js)
- 原始文件：[raw worker.js](https://raw.githubusercontent.com/6siege-cn/los/0294824b7578160ddcc043bf0f0921e6bee81a93/cloud/relay/worker.js)
- SHA-256：`45cae3eb4491bd7520370acbbbb7093db8354634abeb04e3ea54893ace618bfb`

不要重新生成、改写、压缩或“优化”源码。源码只允许 `GET` 和 `OPTIONS /api/relay-health`，其他路径返回 404。

## 6. 推荐部署步骤

优先通过 Cloudflare 网页控制台部署，避免共享账号密码、验证码或 API Token。

1. 使用域名所有者账号登录 Cloudflare。
2. 确认当前账号中的 `icemoe.moe` 区域状态为 Active。
3. 进入 **Workers & Pages**，选择 **Create**，创建 Hello World Worker。
4. 名称填写 `six-siege-cn-relay`。
5. 进入在线代码编辑器，用第 5 节固定版本的完整内容替换示例代码。
6. 部署代码。
7. 不添加绑定、变量、密钥、定时任务或日志服务。
8. 进入该 Worker 的 **Settings > Domains & Routes**。
9. 选择 **Add > Custom Domain**。
10. 输入 `6siege-cnapi.icemoe.moe` 并确认。
11. 等待 Custom Domain 和 HTTPS 证书显示为 Active/可用。

Custom Domain 应由 Cloudflare 自动创建所需 DNS 记录和证书。不要在 DNS 页面提前手动添加记录。

如确需命令行部署，必须显式使用 `cloud/relay/wrangler.jsonc`，且不得误用 `cloud/wrangler.jsonc`；后者属于主 API 并包含 D1 配置。首次部署不建议使用命令行。

## 7. 部署方只读验证

### 7.1 健康检查

请求：

```text
GET https://6siege-cnapi.icemoe.moe/api/relay-health
```

当前预期状态码为 `200`，响应至少应满足：

```json
{
  "ok": true,
  "relay": "ready",
  "relayVersion": 1,
  "upstream": "ready"
}
```

`upstreamVersion` 当前预计为 `3`，将来主 API 升级时可以是更高整数。

### 7.2 确认业务路径未开放

只允许执行以下无副作用检查：

```text
GET https://6siege-cnapi.icemoe.moe/api/matches
```

预期状态码为 `404`，响应为：

```json
{"error":"接口尚未开放"}
```

不得为了测试而发送真实上传、撤回、修改或删除请求。

### 7.3 跨域检查

带以下请求头访问健康接口：

```text
Origin: https://6siege-cn.github.io
```

预期响应头包含：

```text
Access-Control-Allow-Origin: https://6siege-cn.github.io
Cache-Control: no-store
```

## 8. 向项目所有者报告

部署方代理完成后应使用下面的格式报告，未知项写“未知”，不要猜测：

```text
阶段：中转连接第一阶段
Worker：six-siege-cn-relay
自定义域名：6siege-cnapi.icemoe.moe
Worker 部署状态：成功/失败
Custom Domain 状态：Active/等待中/失败
HTTPS 证书状态：Active/等待中/失败
健康检查 HTTP 状态：
健康检查响应：
未开放路径 HTTP 状态：
未开放路径响应：
是否修改过既有 DNS 记录：否
是否添加资源绑定或密钥：否
异常或 Cloudflare 原始提示：
结论：已部署，等待中国大陆无代理人工验收
```

不要在报告中包含账号邮箱、Cookie、访问令牌、验证码、账单信息或完整后台截图中的个人信息。

## 9. 项目所有者人工验收

部署方报告成功后，项目所有者关闭所有代理，通过中国大陆普通家庭宽带和/或移动网络打开：

```text
https://6siege-cnapi.icemoe.moe/api/relay-health
```

将实际页面内容或错误截图发回项目任务。验收前不得继续开放正式业务路径。

## 10. 回滚

如部署错误或大陆连接不稳定：

1. 在 `six-siege-cn-relay` 的 Domains & Routes 中删除 `6siege-cnapi.icemoe.moe` Custom Domain。
2. 确认仅删除 Cloudflare 为该 Custom Domain 自动创建的记录。
3. 删除 `six-siege-cn-relay` Worker。

不得删除主域名、`www`、邮件或其他既有记录。第一阶段没有数据库变更，无需数据回滚。
