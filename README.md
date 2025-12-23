# 自荐：欢迎关注微信公众号“**Yoho前端**”，当前账号目前我一个人维护，如果你也喜欢技术不妨加入一起发表好的文章~

# 阿里云 OSS SSL 证书自动更新工具

这是一个使用 Node.js 编写的自动化脚本，用于更新阿里云 OSS 自定义域名的 SSL 证书。该工具基于阿里云提供的 [ossutil](https://help.aliyun.com/zh/oss/developer-reference/bucket-cname#title-epn-w0v-n0j) 命令行工具。[云解析dns](https://help.aliyun.com/zh/dns/api-alidns-2015-01-09-updatedomainrecord?spm=a2c4g.11186623.help-menu-29697.d_6_0_4_2_3.7ce96b12omH0je&scm=20140722.H_2355677._.OR_help-T_cn~zh-V_1)

## 功能特性

- ✅ 自动更新 OSS Bucket 自定义域名的 SSL 证书
- ✅ 支持批量更新多个域名
- ✅ **集成 certbot 自动生成证书**（支持普通域名和泛域名）
- ✅ **🆕 阿里云DNS自动验证**（无需手动添加TXT记录）
- ✅ 自动查找 certbot 生成的证书路径
- ✅ 支持从文件读取证书和私钥
- ✅ 自动生成证书配置 XML 文件
- ✅ 提供详细的执行日志
- ✅ 支持配置文件配置方式
- ✅ 自动清理临时文件

## 前置要求

### 1. 安装 ossutil（版本 1.7.0 或更高版本）

首先需要安装阿里云的 ossutil 命令行工具：

**macOS/Linux:**
```bash
# 下载 ossutil
wget https://gosspublic.alicdn.com/ossutil/1.7.15/ossutil-v1.7.15-mac-arm64.zip
# 或者对于 Intel Mac
wget https://gosspublic.alicdn.com/ossutil/1.7.15/ossutil-v1.7.15-mac-amd64.zip

# 解压
unzip ossutil-v1.7.15-mac-*.zip

# 移动到系统路径
sudo mv ossutil /usr/local/bin/
sudo chmod +x /usr/local/bin/ossutil

# 验证安装
ossutil --version
```

**Windows:**
```powershell
# 下载并解压后，将 ossutil.exe 添加到系统 PATH
```

更多安装方式请参考：https://help.aliyun.com/document_detail/120075.html

### 2. 安装 certbot（可选，用于自动生成证书）

如果你想使用脚本自动生成 SSL 证书，需要安装 certbot：

**macOS:**
```bash
brew install certbot
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install certbot
```

**CentOS/RHEL:**
```bash
sudo yum install certbot
```

验证安装：
```bash
certbot --version
```

更多安装方式请参考：https://certbot.eff.org/instructions

### 3. 安装 Node.js

确保已安装 Node.js 14 或更高版本：

```bash
node --version
```

## 安装

### ⚠️ 重要提示：如果遇到oss: service returned error: StatusCode=403, ErrorCode=AccessDenied, ErrorMessage="You are forbidden to yundun-cert:CreateSSLCertificate"或者cdn相关的权限问题，需要去RAM添加对应的权限[添加RAM权限](https://ram.console.aliyun.com)
将这三个权限添加上：AliyunDNSFullAccess、AliyunOSSFullAccess、AliyunYundunCertFullAccess

如果你还不清楚什么是 RAM 账号的话，可以参考我写的这篇文章[如何添加RAM](https://mp.weixin.qq.com/s/agdD5vxVnzI4IliEEIPsCg)
---

1. 克隆或下载此项目：

```bash
cd autoUpdateSSL
```

2. 安装依赖：

```bash
npm install
```

3. 创建配置文件：

```bash
cp config.example.json config.json
```

## 配置

### 使用配置文件

编辑 `config.json` 文件：

**示例 1: 使用现有证书文件**
```json
{
  "accessKeyId": "your-access-key-id",
  "accessKeySecret": "your-access-key-secret",
  "endpoint": "oss-***-***.aliyuncs.com",
  "domains": [
    {
      "bucket": "your-bucket-name",
      "domain": "example.com",
      "certPath": "./certs/example.com/fullchain.pem",
      "keyPath": "./certs/example.com/privkey.pem",
      "certId": "493****-cn-hangzhou",
      "previousCertId": "",
      "generateCert": false
    }
  ]
}
```

**示例 2: 使用 certbot 自动生成普通域名证书（阿里云DNS自动验证）**
```json
{
  "accessKeyId": "your-access-key-id",
  "accessKeySecret": "your-access-key-secret",
  "endpoint": "oss-***-***.aliyuncs.com",
  "domains": [
    {
      "bucket": "your-bucket-name",
      "domain": "example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "certId": "",
      "previousCertId": "",
      "generateCert": true,
      "isWildcard": false,
      "email": "your-email@example.com",
      "useAliyunDNS": true
    }
  ]
}
```

**示例 3: 使用 certbot 自动生成泛域名证书（阿里云DNS自动验证）**
```json
{
  "accessKeyId": "your-access-key-id",
  "accessKeySecret": "your-access-key-secret",
  "endpoint": "oss-***-***.aliyuncs.com",
  "domains": [
    {
      "bucket": "your-bucket-name",
      "domain": "example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "certId": "",
      "previousCertId": "",
      "generateCert": true,
      "isWildcard": true,
      "email": "your-email@example.com",
      "useAliyunDNS": true
    }
  ]
}
```

### 配置说明

| 参数 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `accessKeyId` | 阿里云 AccessKey ID | 是 | - |
| `accessKeySecret` | 阿里云 AccessKey Secret | 是 | - |
| `endpoint` | OSS Endpoint，如 `oss-***-***.aliyuncs.com` | 是 | - |
| `domains` | 域名配置数组 | 是 | - |
| `domains[].bucket` | OSS Bucket 名称 | 是 | - |
| `domains[].domain` | 自定义域名（不含通配符 `*`） | 是 | - |
| `domains[].certPath` | 证书文件路径，可设为 `auto` 自动查找 | 是 | - |
| `domains[].keyPath` | 私钥文件路径，可设为 `auto` 自动查找 | 是 | - |
| `domains[].certId` | 证书 ID（用于 CAS 证书） | 否 | "" |
| `domains[].previousCertId` | 上一个证书 ID | 否 | "" |
| `domains[].generateCert` | 是否使用 certbot 生成证书 | 否 | false |
| `domains[].isWildcard` | 是否为泛域名（生成 `*.domain.com`） | 否 | false |
| `domains[].email` | 用于 certbot 的邮箱地址 | 否 | "" |
| `domains[].useAliyunDNS` | 🆕 是否使用阿里云DNS自动验证（无需手动添加TXT记录） | 否 | true |
| `domains[].daysBeforeExpiry` | ⭐ 证书过期前多少天开始更新（推荐设置为30） | 否 | 30 |
| `domains[].forceRenewal` | 是否强制重新生成证书（无视有效期） | 否 | false |

## 使用方法

### 方式 1: 使用 certbot 自动生成证书（推荐）

这是最简单的方式，脚本会自动调用 certbot 生成证书并更新到 OSS。

**配置文件示例：**
```json
{
  "accessKeyId": "your-access-key-id",
  "accessKeySecret": "your-access-key-secret",
  "endpoint": "oss-***-***.aliyuncs.com",
  "domains": [
    {
      "bucket": "your-bucket-name",
      "domain": "example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": true,
      "isWildcard": false,
      "email": "your-email@example.com"
    }
  ]
}
```

**运行脚本：**
```bash
npm start
```

**执行流程：**
1. 脚本会调用 certbot 生成证书
2. certbot 会要求你添加 DNS TXT 记录来验证域名所有权
3. 按照提示在你的 DNS 服务商处添加记录
4. 等待 DNS 记录生效后按回车继续
5. 证书生成成功后自动更新到 OSS

**生成泛域名证书：**
```json
{
  "domain": "example.com",
  "generateCert": true,
  "isWildcard": true
}
```
这将生成 `*.example.com` 的泛域名证书。

### 方式 2: 使用现有证书文件

如果你已经有证书文件，可以直接指定路径。

**配置文件示例：**
```json
{
  "domains": [
    {
      "bucket": "your-bucket-name",
      "domain": "example.com",
      "certPath": "./certs/example.com/fullchain.pem",
      "keyPath": "./certs/example.com/privkey.pem",
      "generateCert": false
    }
  ]
}
```

**运行脚本：**
```bash
npm start
```

### 方式 3: 使用 certbot 已生成的证书

如果你已经使用 certbot 生成了证书，可以设置 `certPath` 和 `keyPath` 为 `auto`，脚本会自动从 `/etc/letsencrypt/live/` 查找。

**配置文件示例：**
```json
{
  "domains": [
    {
      "bucket": "your-bucket-name",
      "domain": "example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": false
    }
  ]
}
```

### 证书文件准备

确保你的证书文件是 PEM 格式：

```
certs/
├── example.com/
│   ├── fullchain.pem  # 完整证书链
│   └── privkey.pem    # 私钥
└── example.org/
    ├── fullchain.pem
    └── privkey.pem
```

**如果你使用 Let's Encrypt 的 certbot：**

```bash
# 证书通常位于
/etc/letsencrypt/live/example.com/fullchain.pem
/etc/letsencrypt/live/example.com/privkey.pem
```

### 手动使用 certbot 生成证书

如果你想手动生成证书，可以使用以下命令：

**生成普通域名证书：**
```bash
sudo certbot certonly -d example.com --manual --preferred-challenges dns
```

**生成泛域名证书：**
```bash
sudo certbot certonly -d *.example.com --manual --preferred-challenges dns
```

按照提示添加 DNS TXT 记录，验证通过后证书会保存在 `/etc/letsencrypt/live/example.com/`。

参考文档：[为 RAM 用户授权自定义的权限策略](https://help.aliyun.com/document_detail/100680.html)

## 工作流程

### 使用 certbot 自动生成证书的流程

1. **检查工具** - 验证 ossutil 和 certbot 是否已安装
2. **读取配置** - 从 config.json 读取配置信息
3. **生成证书** - 调用 certbot 生成证书（需要手动添加 DNS 记录）
4. **查找证书** - 自动从 `/etc/letsencrypt/live/` 查找生成的证书
5. **读取证书** - 读取证书和私钥文件
6. **生成 XML** - 生成证书配置 XML 文件
7. **执行更新** - 调用 ossutil 更新证书到 OSS
8. **清理临时文件** - 删除临时生成的 XML 文件
9. **输出结果** - 显示更新结果摘要

### 使用现有证书的流程

1. **检查 ossutil** - 验证 ossutil 是否已安装
2. **读取配置** - 从 config.json 读取配置信息
3. **读取证书** - 读取证书和私钥文件
4. **生成 XML** - 生成证书配置 XML 文件
5. **执行更新** - 调用 ossutil 更新证书
6. **清理临时文件** - 删除临时生成的 XML 文件
7. **输出结果** - 显示更新结果摘要

## 故障排查

### 问题 1: ossutil 未找到

```
✗ ossutil 未安装或未在 PATH 中
```

**解决方案：** 确保 ossutil 已安装并添加到系统 PATH。

### 问题 2: certbot 未找到

```
⚠ certbot 未安装，将跳过自动生成证书功能
```

**解决方案：** 如果需要使用自动生成证书功能，请安装 certbot：
```bash
# macOS
brew install certbot

# Ubuntu/Debian
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot
```

### 问题 3: certbot 需要 root 权限

```
certbot 执行失败
```

**解决方案：** certbot 通常需要 root 权限来保存证书：
```bash
sudo node index.js
```

或者手动运行 certbot 生成证书后，将 `generateCert` 设为 `false`，使用 `auto` 路径。

### 问题 4: 读取证书文件失败

```
✗ 读取证书文件失败: ENOENT
```

**解决方案：** 
- 检查证书文件路径是否正确
- 如果使用 `auto`，确保证书在 `/etc/letsencrypt/live/域名/` 目录下
- 确保有读取权限（可能需要 sudo）

### 问题 5: DNS 记录验证失败

```
The Certificate Authority failed to verify the manually created DNS TXT records
```

### 问题 6: 权限不足

```
AccessDenied
```

**解决方案：** 检查 AccessKey 是否有足够的权限，参考上面的权限要求部分。

### 问题 7: Endpoint 错误

```
InvalidEndpoint
```

**解决方案：** 确认 endpoint 配置正确，格式如：`oss-***-***.aliyuncs.com`

## 安全建议

1. **保护配置文件** - 确保 `config.json`文件不被提交到版本控制系统
2. **使用 RAM 子账号** - 不要使用主账号的 AccessKey，创建具有最小权限的 RAM 子账号
3. **定期轮换密钥** - 定期更换 AccessKey
4. **保护私钥文件** - 确保证书私钥文件权限设置正确（建议 600）

```bash
chmod 600 certs/*/privkey.pem
```

## 相关链接

- [阿里云 OSS bucket-cname 文档](https://help.aliyun.com/zh/oss/developer-reference/bucket-cname#title-epn-w0v-n0j)
- [ossutil 下载和安装](https://help.aliyun.com/document_detail/120075.html)
- [OSS 自定义域名绑定](https://help.aliyun.com/document_detail/31902.html)
- [Let's Encrypt](https://letsencrypt.org/)

## 📄 许可证

本项目采用 **GNU General Public License v3.0 (GPL-3.0)** 开源许可证。

### ✅ 您可以：
- ✓ 自由使用本软件（包括商业用途）
- ✓ 修改源代码
- ✓ 分发原始或修改后的版本
- ✓ 在私有项目中使用

### ⚠️ 但您必须：
- **保留版权声明**：所有副本必须包含原始版权声明
- **开源衍生作品**：如果分发修改版本，必须以 GPL-3.0 许可证开源
- **提供源代码**：分发时必须提供完整源代码或提供获取途径
- **声明修改**：修改后的文件必须标注修改内容
- **相同许可证**：衍生作品必须使用相同的 GPL-3.0 许可证

### 🚫 限制：
- **不能闭源商用**：不能将本软件或其衍生作品作为闭源软件销售
- **无担保**：本软件按"原样"提供，不提供任何明示或暗示的担保

### 💼 商业授权

如果您需要将本软件用于**闭源商业项目**，而不想遵守 GPL-3.0 的开源要求，请联系作者获取商业授权：

- **作者**：xiaodaipi173
- **微信公众号**：Yoho前端
- **用途**：闭源商业授权、技术支持、定制开发

### 📖 详细信息

完整的许可证文本请查看 [LICENSE](./LICENSE) 文件，或访问：
https://www.gnu.org/licenses/gpl-3.0.html

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南：
1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

**注意**：所有贡献的代码将自动采用 GPL-3.0 许可证。

## 常见使用场景

### 场景 1: 首次为域名申请证书并绑定到 OSS

```json
{
  "domains": [
    {
      "bucket": "my-bucket",
      "domain": "cdn.example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": true,
      "isWildcard": false,
      "email": "admin@example.com"
    }
  ]
}
```

运行 `npm start`，按照提示添加 DNS 记录，证书生成后自动绑定到 OSS。

### 场景 2: 为多个子域名申请泛域名证书

```json
{
  "domains": [
    {
      "bucket": "my-bucket",
      "domain": "example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": true,
      "isWildcard": true,
      "email": "admin@example.com"
    }
  ]
}
```

这将生成 `*.example.com` 的泛域名证书，可用于所有子域名。

### 场景 3: 续期已有证书

Let's Encrypt 证书有效期为 90 天，需要定期续期。

**方法 1: 手动续期**
```bash
sudo certbot renew
npm start
```

**方法 2: 自动续期（推荐）**

设置 cron 任务，每月自动续期并更新到 OSS：
```cron
0 2 1 * * sudo certbot renew && cd /path/to/autoUpdateSSL && node index.js
```

### 场景 4: 批量更新多个域名

```json
{
  "domains": [
    {
      "bucket": "bucket1",
      "domain": "site1.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": false
    },
    {
      "bucket": "bucket2",
      "domain": "site2.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": false
    }
  ]
}
```

一次性更新多个域名的证书到不同的 Bucket。

### 场景 5: 设置定时任务自动更新（生产环境推荐）

如果你想让服务器自动定时执行证书更新，可以使用 Linux 的 cron 定时任务。这样可以实现证书的自动化管理，无需手动干预。

**推荐配置方案：**

#### 方案A：30天阈值 + 每周执行 ⭐ **最推荐**

这是最推荐的生产环境配置方案，既保证了证书及时更新，又避免了频繁的不必要操作。

##### 📋 方案说明

**工作原理：**
- 定时任务每周执行一次（如每周一凌晨3点）
- 脚本每次运行时会检查证书的剩余有效期
- **只有当证书剩余有效期 ≤ 30 天时，才会执行更新操作**
- 如果证书还很新（>30天），脚本会跳过更新，避免不必要的 API 调用

**为什么推荐30天阈值？**
- ✅ Let's Encrypt 证书有效期为 90 天
- ✅ 30 天提供了充足的续期缓冲时间
- ✅ 即使某次执行失败，还有多次重试机会
- ✅ 符合 Let's Encrypt 官方推荐的最佳实践

**为什么选择每周执行？**
- ✅ 频率适中，不会给服务器带来压力
- ✅ 保证在证书到期前有多次检查机会
- ✅ 即使连续几次失败，也有足够时间人工介入
- ✅ 避免每天执行造成的日志冗余

##### 🔧 配置步骤

**第一步：配置证书更新阈值**

编辑你的 `config.json` 文件，为每个域名添加 `daysBeforeExpiry` 配置：

```json
{
  "accessKeyId": "your-access-key-id",
  "accessKeySecret": "your-access-key-secret",
  "endpoint": "oss-cn-hangzhou.aliyuncs.com",
  "domains": [
    {
      "bucket": "my-bucket",
      "domain": "example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": true,
      "isWildcard": false,
      "email": "admin@example.com",
      "useAliyunDNS": true,
      "daysBeforeExpiry": 30  // ⭐ 证书剩余30天或更少时才更新，不写默认也是30天
    },
    {
      "bucket": "another-bucket",
      "domain": "api.example.com",
      "certPath": "auto",
      "keyPath": "auto",
      "generateCert": false,
      "daysBeforeExpiry": 30  // 多个域名都可以设置
    }
  ]
}
```

> **💡 提示：** 如果不设置 `daysBeforeExpiry`，默认值为 30 天。你可以根据实际需求调整这个值（建议范围：20-40天）。

**第二步：设置定时任务**

1. **赋予执行脚本权限：**

```bash
chmod +x /root/autoUpdateSSL/run-update.sh
```

2. **编辑 crontab 配置：**

```bash
crontab -e
```

3. **添加定时任务配置：**

```bash
# 每周一凌晨 3:00 执行证书检查和更新
0 3 * * 1 /root/autoUpdateSSL/run-update.sh >> /var/log/ssl-update.log 2>&1
```

**其他常用的 crontab 时间配置：**

```bash
# 每周日凌晨 2:00 执行
0 2 * * 0 /root/autoUpdateSSL/run-update.sh >> /var/log/ssl-update.log 2>&1

# 每周三凌晨 4:00 执行
0 4 * * 3 /root/autoUpdateSSL/run-update.sh >> /var/log/ssl-update.log 2>&1

# 每月1号凌晨 2:00 执行（如果你想降低频率）
0 2 1 * * /root/autoUpdateSSL/run-update.sh >> /var/log/ssl-update.log 2>&1
```

> **📌 注意：** 记得替换 `/root/autoUpdateSSL/` 为你的实际安装路径。

##### 📊 验证配置

**1. 查看已设置的定时任务：**

```bash
crontab -l
```

**2. 手动测试执行：**

```bash
# 直接运行脚本测试
/root/autoUpdateSSL/run-update.sh

# 或者进入目录执行
cd /root/autoUpdateSSL
npm start
```

**3. 查看执行日志：**

```bash
# 查看最近的执行日志
tail -f /var/log/ssl-update.log

# 查看最近 50 行日志
tail -n 50 /var/log/ssl-update.log

# 搜索特定域名的更新记录
grep "example.com" /var/log/ssl-update.log
```

##### 📋 执行输出示例

**情况1：证书还未到更新时间（剩余60天）**

```
=== SSL 证书自动更新开始 ===
时间: 2025-12-23 03:00:01

检查域名: example.com
证书剩余有效期: 60 天
更新阈值: 30 天
状态: ⏭️  跳过更新（证书还很新）

=== 执行完成 ===
```

**情况2：证书需要更新（剩余25天）**

```
=== SSL 证书自动更新开始 ===
时间: 2025-12-23 03:00:01

检查域名: example.com
证书剩余有效期: 25 天
更新阈值: 30 天
状态: 🔄 开始更新证书...

✓ 证书生成成功
✓ 证书已更新到 OSS
✓ 更新完成！

=== 执行完成 ===
```

##### ⚠️ 注意事项

1. **确保脚本有执行权限：**
   ```bash
   ls -la /root/autoUpdateSSL/run-update.sh
   # 应该显示 -rwxr-xr-x
   ```

2. **检查 Node.js 环境：**
   - 确保系统全局可以访问 `node` 和 `npm` 命令
   - 如果使用 nvm，可能需要在脚本中添加 nvm 初始化

3. **日志管理：**
   - 定期清理日志文件，避免占用过多磁盘空间
   - 可以使用 logrotate 进行自动日志轮转

4. **监控告警：**
   - 建议配置监控脚本，当证书更新失败时发送邮件或短信通知
   - 可以监控日志中的错误关键词

##### 🔍 故障排查

**定时任务没有执行？**

1. 检查 cron 服务是否运行：
   ```bash
   systemctl status cron    # Debian/Ubuntu
   systemctl status crond   # CentOS/RHEL
   ```

2. 查看 cron 执行日志：
   ```bash
   grep CRON /var/log/syslog    # Debian/Ubuntu
   grep CRON /var/log/cron      # CentOS/RHEL
   ```

3. 确认脚本路径正确：
   ```bash
   which node
   # 如果 cron 环境找不到 node，需要在脚本中使用绝对路径
   ```

**脚本执行但没有更新？**

- 检查证书剩余有效期是否 ≤ 阈值
- 查看日志文件中的错误信息
- 手动运行脚本查看详细输出

##### 💡 高级技巧

**定制化阈值策略：**

你可以为不同域名设置不同的更新阈值：

```json
{
  "domains": [
    {
      "domain": "important-site.com",
      "daysBeforeExpiry": 40  // 重要网站提前40天更新，更保守
    },
    {
      "domain": "test-site.com",
      "daysBeforeExpiry": 20  // 测试网站20天更新即可
    }
  ]
}
```

**强制更新配置：**

如果需要立即更新证书（忽略阈值检查），可以临时添加：

```json
{
  "domain": "example.com",
  "forceRenewal": true  // 强制重新生成证书
}
```

执行一次后记得移除此配置，避免每次都强制更新。


