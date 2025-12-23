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


