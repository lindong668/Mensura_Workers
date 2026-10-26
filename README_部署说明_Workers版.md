# 6号 Mensura（saoo.me 根域）Cloudflare Workers 版 —— K1

> 生成日期：2026-10-26
> 部署形态：**Cloudflare Workers + Assets**（不是 GitHub Pages，不是 CF Pages）
> ★ 用途：作为 **saoo.me 根域**提交 AdSense 审核的载体

---

## 0. ★ 为什么换成 Workers 版

之前走 GitHub Pages 遇到两件事：

```
① Custom domain 填 saoo.me → 报「已被占用」
   真实原因：同一个仓库的 Pages 上还挂着旧域 596.us.ci，
            GitHub 认为域名仍被占用 → 必须先删掉 596 的 DNS 才能绑新的
② GitHub Pages 需要：域名验证 + 4 条 A 记录（灰云）+ 等证书签发
   环节多、等待久
```

**Workers 版直接绕开这些**：saoo.me 已经托管在 CF，用 routes 绑定即可，
不需要 GitHub 域名验证、不需要 A 记录、不需要等 GitHub 签证书。

```
★ I3（CF Pages 版）作废，改用本包 K1。
```

---

## 1. 站点信息

| 项 | 值 |
|---|---|
| 域名 | https://saoo.me（**根域**） |
| Worker 名称 | `mensura-saoo` |
| 部署形态 | Cloudflare Workers + Assets |
| 静态文件 | 43 个（20 工具 + 4 分类 + 6 静态页 + 404） |
| sitemap | 31 条 URL，已内联进 Worker（lastmod 2026-10-26） |
| 域名残留 | bbroot 0 / 596.us.ci 0 / saoo.me 265 处 ✅ |

---

## 2. 部署步骤

### 方式一：网页上传（推荐，你一直在用）

```
CF 控制台 → Workers 和 Pages → 创建 → Workers → 上传资产
→ 上传 public/ + src/ + wrangler.toml
→ Worker 名填：mensura-saoo
→ 部署
```

routes 已写在 `wrangler.toml` 里（`saoo.me/*`），部署后自动绑定，
**不需要手动去「域和路由」添加**。

若 CF 提示「域名缺少 DNS 记录」，按它的提示**自动添加**即可
（通常是 AAAA `100::` 代理记录），这是 routes 模式的正常要求。

### 方式二：命令行

```
npx wrangler deploy
```

---

## 3. ★ 部署前置

```
① saoo.me 已托管到 Cloudflare（NS 已改）        ✅ 已完成
② SSL/TLS → 边缘证书 → Universal SSL 状态「有效」
   新接入域名等几分钟到几小时，证书没生效就部署会报 SSL 错误
```

⚠️ **如果之前为 GitHub Pages 加过 A 记录（185.199.x.x）**
   —— 去 CF DNS 里删掉它们，会和 Workers 路由冲突。

---

## 3.5 ★ 关于「每天 10 万请求」额度

Workers 免费版确实有「每天 10 万请求」上限（UTC 0 点重置，超限返回 Error 1027）。
**但本站基本不会碰到**，因为计费规则是这样的：

```
请求能匹配到静态文件（HTML / CSS / JS / 图片）
  → 直接由静态资源返回，不 invoke Worker
  → 免费、不限量、不计入 10 万额度 ✅

请求匹配不到静态文件（404、无扩展名路径、三个 SEO 文件）
  → 才 invoke Worker
  → 计入 10 万额度
```

本站 99% 以上的流量都是页面和静态资源，走的是第一条，**不占额度**。
只有 ads.txt / robots.txt / sitemap.xml 这三个因为配了 `run_worker_first`
让 Worker 接管，会占额度 —— 但那是 Google / AdSense 偶尔抓一次，
一天几十次顶天，相对 10 万可以忽略。

**结论**：就算这站每天几千人访问，也用不到额度的零头。
真到流量起来了，$5/月的 Workers Paid 就没有请求数上限了。

---

## 4. ★★★ Worker 里已硬编码的三个 SEO 文件

这是本方案最大的好处：**不依赖静态上传、不受边缘缓存影响、Content-Type 钉死**。

```
/ads.txt      → text/plain    含 pub-8915931557404979
/robots.txt   → text/plain    含 Mediapartners-Google 放行
/sitemap.xml  → application/xml   31 条 URL 内联
```

**为什么这么做**（5 号站 D19 已验证的血泪教训）：

```
纯静态时，静态文件若未真正部署（404），
src.text() 会拿到 404 错误页的 HTML，
再贴上 application/xml 吐给 Google
= 标着 XML 的 HTML = 解析失败 = GSC「无法抓取」

ads.txt 同理：Content-Type 一旦被猜成 text/html
→ AdSense 判定「ads.txt 无效 / 找不到」→ 审核卡住
```

内联后这三个文件**永远正确**，直接绕开整类问题。

---

## 5. ★★★ 部署后必做的两条 CF 配置

### 5.1 ads.txt 不要开「缓存所有内容」

```
❌ 不要配：页面规则 / Cache Rules → ads.txt → Cache Everything
```

**原因**：Cache Everything 会把 **404 也缓存住**。
某次抖动返回一次 404 被缓存，Google 来抓拿到 404 →
AdSense 从「已授权」变「未找到」，而自己浏览器访问却是正常的。

⚠️ 本包 ads.txt 已由 Worker 硬编码返回，
**但仍不要在 CF 层给它配 Cache Everything**，避免缓存层叠加干扰。

```
建议：Caching → Cache Rules → URI Path equals /ads.txt → Bypass cache
```

### 5.2 放行 Google 爬虫（防 WAF / Bot Fight 误拦）

```
Security → Security Rules → 创建规则
  名称：Allow Google verification
  条件（Or 连接）：
    URI Path equals /ads.txt
    Or URI Path equals /robots.txt
    Or User Agent contains Mediapartners-Google
    Or User Agent contains AdsBot-Google
    Or User Agent contains Googlebot
  动作：Skip
  勾选：☑ All managed rules
        ☑ All Super Bot Fight Mode Rules
        ☑ All rate limiting rules
```

再确认全局安全级别：
```
Security → Settings → Security Level → 必须是 Medium 或 Low
（High / "I'm under attack" 会弹 JS 挑战，Googlebot 直接跪）
```

---

## 6. 验收清单

部署完成后逐条验（手机浏览器无痕模式）：

```
https://saoo.me/                        首页正常显示工具目录
https://saoo.me/robots.txt              含 Mediapartners-Google Allow: /
https://saoo.me/ads.txt                 google.com, pub-8915931557404979, DIRECT, ...
https://saoo.me/sitemap.xml             31 条 URL，全为 saoo.me
https://saoo.me/google6474e28bb6098302.html   显示验证串（GSC 前缀验证用）
https://saoo.me/tools/length-converter.html   工具页能实际计算 ★
https://www.saoo.me/                    301 跳到 https://saoo.me/
```

★ **工具页必须能真的算** —— 这是 AdSense 审核最加分的一点。
务必抽查 2~3 个（length-converter / percentage-calculator / age-calculator）。

---

## 7. 关于 www.saoo.me 跳转

Worker 里已写 `www.saoo.me → saoo.me` 的 301。
**但这条要生效，需要 DNS 里有 www 记录**，二选一：

```
方案 A：CF DNS 加 CNAME  www → saoo.me（橙云）
        再在 routes 里加一条 www.saoo.me/*
方案 B：不加，www.saoo.me 直接解析不了（无害，只是没人这么访问）
```

根域和子域不同：5 号 `home.saoo.me` 的 www 是死代码（四级域名没人访问），
**但根域的 www.saoo.me 是真实存在的常见输入，这里值得加。**

---

## 8. 旧域 596.us.ci 的处理

现状：你已把 596.us.ci 的 DNS 删掉 → 该域目前**完全悬空、打不开**。

```
A：不管它
   → Google 陆续抓 404，几周后索引清掉
   → 旧收录作废

B：抢救（推荐）
   → 部署 301跳转项目_596.us.ci到saoo.me_CFPages专用.zip
   → CF Pages 自定义域填 596.us.ci，按提示加 DNS
   → 旧收录的访客直接进新站，权重转移
```

顺序（不可颠倒）：
```
① saoo.me 部署本包并验收全绿
② 再部署 596 的 301 跳转
③ 再 AdSense 提交 saoo.me（撤掉 596 的申请）
```

---

## 9. 提交 AdSense 审核

```
AdSense → 网站 → 添加网站 → 填：saoo.me（裸域，不带 www）
→ 等待审核（全新根域 2~4 周）
```

⚠️ 提交后**不要再改 ads.txt** —— 每改一次重抓等待周期重置。

**根域通过后**：home.saoo.me（房贷站 D19）及后续 pic / oil / unit 子域
**自动获得投放资格，永久免审**。

---

## 10. 文件结构

```
wrangler.toml      部署配置（name = mensura-saoo, routes = saoo.me/*）
src/index.js       Worker 入口（www 跳转 + 三个 SEO 文件硬编码 + 404 兜底）
package.json
public/            静态资源（43 个文件）
  ├ index.html            首页（工具目录）
  ├ 404.html
  ├ google6474e28bb6098302.html   Google 站点验证文件
  ├ robots.txt / sitemap.xml / ads.txt   （Worker 会硬拦截，静态层为双保险）
  ├ _headers              静态层 MIME 兜底
  ├ category/             4 个分类页
  ├ tools/                20 个工具页
  ├ pages/                about / contact / privacy / terms / disclaimer / methodology
  └ assets/               css + js + img
```

---

## 11. 与其他包的关系

```
本包 K1     saoo.me 根域 Mensura（Workers）   ← ★ 现役，提交审核用
D19         home.saoo.me 房贷站（Workers）     ← 已部署，等根域过审后沾光
【作废】I3  saoo.me 根域 CF Pages 版          ← 已弃用，勿用
【作废】C18 saoo.me 根域导航站                 ← 已弃用，勿用
（待做）    pic.saoo.me / oil.saoo.me / unit.saoo.me
```
