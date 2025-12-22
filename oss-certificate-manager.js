import { __dirname } from "./index.js";
import path from "path";
import fs from "fs/promises";
import Alidns20150109, * as $Alidns20150109 from "@alicloud/alidns20150109";
import * as $OpenApi from "@alicloud/openapi-client";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec); // 将 exec 函数转换为异步函数
const DEFAULT_DAYS_BEFORE_EXPIRY = 3; // 证书过期前多少天开始更新（默认3天）
const DEFAULT_MAX_RETRIES = 15; // 最大重试次数（默认15次）
const DEFAULT_CERTBOT_PATH = "/etc/letsencrypt/live"; // certbot 默认证书路径
const DEFAULT_CERTBOT_CERT_FILE = "fullchain.pem"; // certbot 默认证书文件
const DEFAULT_CERTBOT_KEY_FILE = "privkey.pem"; // certbot 默认私钥文件
const WAIT_TIME_FOR_DNS_RECORD_PROPAGATION = 10000; // 等待 DNS 记录生效时间（默认10秒）
const MAX_BUFFER_SIZE = 1024 * 1024 * 10; // 最大缓冲区大小（默认10MB）

/**
 * OssCertificateManager 类，用于更新 OSS SSL 证书
 */
class OssCertificateManager {
  /**
   * 构造函数，初始化配置文件、临时 XML 文件和阿里云 DNS 客户端
   * @param {Object} config - 配置文件，用于存储配置信息
   */
  constructor(config) {
    this.config = config;
    // 临时 XML 文件，用于存储证书配置
    this.tempXmlFile = path.join(__dirname, `cert_config_${Date.now()}.xml`);
    // 阿里云 DNS 客户端，用于管理 DNS 记录
    this.dnsClient = null;
  }

  /**
   * 创建阿里云 DNS 客户端
   */
  createDNSClient() {
    if (!this.dnsClient) {
      const config = new $OpenApi.Config({
        accessKeyId: this.config.accessKeyId,
        accessKeySecret: this.config.accessKeySecret,
      });
      config.endpoint = this.config.endpoint;
      this.dnsClient = new Alidns20150109.default(config);
    }
    return this.dnsClient;
  }

  /**
   * 获取域名的 DNS 记录列表
   */
  async getDomainRecords(domain) {
    try {
      const client = this.createDNSClient();
      // 从完整域名中提取主域名（例如：从 xxx.xx.com 中提取 xx.com）
      const parts = domain.split(".");
      const mainDomain = parts.slice(-2).join(".");

      // 获取域名的 DNS 记录列表
      const request = new $Alidns20150109.DescribeDomainRecordsRequest({
        domainName: mainDomain,
      });

      const response = await client.describeDomainRecords(request);
      // 返回 DNS 记录列表
      return response.body.domainRecords.record;
    } catch (error) {
      // 检查是否是权限问题
      if (error.message && error.message.includes("Forbidden.RAM")) {
        console.error("\n✗ DNS API 权限不足!");
        console.error("您的 AccessKey 没有操作 DNS 记录的权限。");
        console.error("\n解决方案:");
        /**
         * AliyunDNSFullAccess：自动添加 DNS 验证记录
         * AliyunOSSFullAccess：访问和管理 OSS Bucket
         * AliyunYundunCertFullAccess：绑定 SSL 证书到 Bucket
         */
        console.error(
          "如果使用的是 RAM 子账号，请在阿里云控制台添加 DNS 权限:AliyunDNSFullAccess、AliyunOSSFullAccess、AliyunYundunCertFullAccess"
        );
        console.error("- 登录 RAM 控制台: https://ram.console.aliyun.com");
      } else {
        console.error("获取 DNS 记录失败:", error.message);
      }
      throw error;
    }
  }

  /**
   * 更新或添加 DNS TXT 记录
   */
  async updateDNSTXTRecord(domain, txtValue) {
    try {
      console.log(`\n正在更新 DNS TXT 记录...`);
      const client = this.createDNSClient();

      // 从完整域名中提取主域名和子域名
      const parts = domain.split(".");
      const mainDomain = parts.slice(-2).join(".");
      const subDomain = parts.slice(0, -2).join(".");

      // 记录名是 _acme-challenge 加上子域名（如果有）
      let recordName = "_acme-challenge";
      if (subDomain) {
        recordName = `_acme-challenge.${subDomain}`;
      }

      console.log(`主域名: ${mainDomain}`);
      console.log(`记录名: ${recordName}`);
      console.log(`TXT 值: ${txtValue}`);

      // 获取现有记录
      const records = await this.getDomainRecords(mainDomain);
      // 查找是否存在相同的记录
      const existingRecord = records.find(
        (r) => r.RR === recordName && r.type === "TXT"
      );

      if (existingRecord) {
        // 更新现有记录
        console.log(`找到现有记录 ID: ${existingRecord.recordId}`);
        const updateRequest = new $Alidns20150109.UpdateDomainRecordRequest({
          recordId: existingRecord.recordId,
          RR: recordName,
          type: "TXT",
          value: txtValue,
        });

        await client.updateDomainRecord(updateRequest);
        console.log("✓ DNS TXT 记录更新成功！");
      } else {
        // 添加新记录
        console.log("未找到现有记录，将添加新记录");
        const addRequest = new $Alidns20150109.AddDomainRecordRequest({
          domainName: mainDomain,
          RR: recordName,
          type: "TXT",
          value: txtValue,
        });

        await client.addDomainRecord(addRequest);
        console.log("✓ DNS TXT 记录添加成功！");
      }

      return true;
    } catch (error) {
      console.error("✗ DNS TXT 记录更新失败:", error.message);
      throw error;
    }
  }

  /**
   * 检查 DNS TXT 记录是否已生效
   * @param {string} domain - 域名
   * @param {string} expectedValue - 期望的 TXT 值
   * @param {number} maxRetries - 最大重试次数（默认15次）
   */
  async checkDNSRecordPropagation(
    domain,
    expectedValue,
    maxRetries = DEFAULT_MAX_RETRIES
  ) {
    console.log("\n正在检查 DNS 记录是否生效...");

    for (let i = 0; i < maxRetries; i++) {
      try {
        const recordName = `_acme-challenge.${domain}`;
        // 使用 dig 命令检查 DNS 记录是否生效
        const { stdout } = await execAsync(`dig ${recordName} TXT +short`);

        if (stdout.includes(expectedValue)) {
          console.log("✓ DNS 记录已生效！");
          return true;
        }

        console.log(`等待 DNS 记录生效... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) =>
          setTimeout(resolve, WAIT_TIME_FOR_DNS_RECORD_PROPAGATION)
        );
      } catch (error) {
        console.log(`DNS 检查失败，继续等待... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) =>
          setTimeout(resolve, WAIT_TIME_FOR_DNS_RECORD_PROPAGATION)
        );
      }
    }

    console.warn("⚠ DNS 记录可能未完全生效，但将继续尝试验证");
    return false;
  }

  /**
   * 检查 ossutil 是否已安装
   */
  async checkOSSUtilInstalled() {
    try {
      // 查询 ossutil 版本
      const { stdout } = await execAsync("ossutil --version");
      const version = stdout.trim();
      console.log("✓ ossutil 已安装:", version);

      // 检查版本是否支持 bucket-cname 命令（ossutil 1.7.0 或更高版本）
      const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        const versionNum = versionMatch[1];
        const [major, minor] = versionNum.split(".").map(Number);

        // bucket-cname 命令需要 ossutil 1.7.0 或更高版本
        if (major < 1 || (major === 1 && minor < 7)) {
          console.error(
            `\n✗ 错误: 当前版本: ${versionNum}，ossutil 版本过低，无法继续，所需版本: 1.7.0 或更高`
          );
          console.error("\n请立即升级 ossutil:");
          console.error(
            "1. 下载安装脚本: wget http://gosspublic.alicdn.com/ossutil/install.sh"
          );
          console.error("2. 执行安装: sudo bash install.sh");
          console.error("3. 验证版本: ossutil --version");
          console.error(
            "\n或访问: https://help.aliyun.com/document_detail/120075.html\n"
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(
        "✗ ossutil 未安装或未在 PATH 中，参考：https://help.aliyun.com/document_detail/120075.html"
      );
      return false;
    }
  }

  /**
   * 测试 OSS 连接和权限
   */
  async testOssConnection(bucket) {
    try {
      console.log("\n测试 OSS 连接和权限...");
      const cmd = this.buildOssutilCommand(
        `ls oss://${bucket} --limited-num 1`
      );
      // 隐藏 accessKeySecret
      const safeCmd = cmd.replace(/-k\s+\S+/, "-k ****");
      console.log("测试命令:", safeCmd);

      const { stdout, stderr } = await execAsync(cmd);
      console.log("✓ OSS 连接测试成功");
      if (stdout) console.log("Bucket 内容（前 1 项）:", stdout.trim());
      if (stderr) console.log("警告:", stderr);
      return true;
    } catch (error) {
      console.error("✗ OSS 连接测试失败:");
      console.error(`错误代码: ${error.code}；错误信息：${error.message}`);
      if (error.stdout) console.error("标准输出:", error.stdout);
      if (error.stderr) console.error("错误输出:", error.stderr);

      console.error("\n故障排查建议:");
      console.error("1. 检查 ossutil 是否正确安装和配置");
      console.error("2. 验证 AccessKey ID 和 AccessKey Secret 是否正确");
      console.error("3. 确认 Bucket 名称是否正确");
      console.error(
        "4. 检查 Endpoint 是否正确 (当前: " + this.config.endpoint + ")"
      );
      console.error("5. 验证 RAM 用户是否有访问该 Bucket 的权限");
      console.error("6. 尝试手动运行上面的测试命令查看详细错误\n");

      return false;
    }
  }

  /**
   * 检查 certbot 是否已安装
   */
  async checkCertbotInstalled() {
    try {
      const { stdout } = await execAsync("certbot --version");
      console.log("✓ certbot 已安装:", stdout.trim());
      return true;
    } catch (error) {
      console.warn("⚠ certbot 未安装，将跳过自动生成证书功能");
      console.warn("安装方法: https://certbot.eff.org/instructions");
      return false;
    }
  }

  /**
   * 使用 certbot 生成证书（自动处理 DNS 验证）
   * @param {string} domain - 域名
   * @param {boolean} isWildcard - 是否为泛域名
   * @param {string} email - 邮箱地址（可选）
   * @param {boolean} useAliyunDNS - 是否使用阿里云 DNS 自动更新（可选）
   */
  async generateCertificate(
    domain,
    isWildcard = false,
    email = "",
    useAliyunDNS = false
  ) {
    try {
      const actualDomain = isWildcard ? `*.${domain}` : domain;
      console.log(`\n正在使用 certbot 为域名 ${actualDomain} 生成证书...`);

      console.log("\n⚠ 重要提示:");
      console.log("1. certbot 会要求你添加 DNS TXT 记录");
      console.log("2. 请在 DNS 服务商处添加记录");
      console.log("3. 添加完成后，脚本会自动检查 DNS 记录是否生效");
      console.log("4. DNS 记录生效后会自动继续验证\n");

      const args = [
        "certonly", // 只获取证书，不自动配置 Web 服务器（Nginx/Apache等）
        "-d", // 指定域名
        actualDomain, // 实际域名
        "--manual", // 手动模式
        "--preferred-challenges", // 指定挑战类型
        "dns",
        // 移除 --force-renewal 以避免触发 Let's Encrypt 频率限制，参考：https://letsencrypt.org/docs/rate-limits/#new-certificates-per-exact-set-of-identifiers
        // certbot 会自动判断是否需要更新证书
        ...(email ? ["--email", email, "--agree-tos", "--no-eff-email"] : []), // 指定邮箱地址，同意服务条款，不发送电子邮件通知
      ];

      return new Promise((resolve, reject) => {
        const certbotProcess = spawn("certbot", args, {
          stdio: ["pipe", "pipe", "pipe"], // 使用管道模式以捕获输出
        });

        let outputBuffer = "";
        let txtRecordValue = "";
        let recordName = "";
        let waitingForDNS = false;
        let hasExistingCertPrompt = false; // 标记是否出现"已有证书"提示

        // 处理标准输出
        certbotProcess.stdout.on("data", async (data) => {
          const text = data.toString();
          outputBuffer += text;
          process.stdout.write(text); // 显示输出

          // 检测是否出现"已有证书"提示
          if (
            !hasExistingCertPrompt &&
            (text.includes("existing certificate") ||
              text.includes("has exactly the same domains") ||
              text.includes("What would you like to do?"))
          ) {
            hasExistingCertPrompt = true;
            // 这里会有两个选项，1：保留现有证书，2：重新生成并覆盖现有证书
            console.log(
              "\n检测到已有有效证书提示，自动选择保留现有证书 (选项 1)...\n"
            );
            // 发送 "1" 选择保留现有证书
            certbotProcess.stdin.write("1\n");
          }

          // 检测是否出现了 TXT 记录值
          if (text.includes("with the following value:")) {
            const lines = outputBuffer.split("\n");

            // 查找记录名
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes("_acme-challenge")) {
                recordName = lines[i].trim();
                break;
              }
            }

            // 查找 TXT 值（在 "with the following value:" 之后的下一个非空行）
            // Let's Encrypt 的验证令牌是 43 个字符的 Base64 编码字符串
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes("with the following value:")) {
                // 找到后续的非空行
                for (let j = i + 1; j < lines.length; j++) {
                  const trimmed = lines[j].trim();
                  // 验证令牌特征：
                  // 1. 长度在 40-50 字符之间（通常是 43）
                  // 2. 只包含 Base64 字符（字母、数字、+、/、_、-、=）
                  // 3. 不包含空格或其他特殊字符
                  const isValidToken = /^[A-Za-z0-9_\-+/=]{40,50}$/.test(
                    trimmed
                  );
                  if (isValidToken) {
                    txtRecordValue = trimmed;
                    break;
                  }
                }
                break;
              }
            }

            if (txtRecordValue && !waitingForDNS) {
              waitingForDNS = true;

              console.log(
                "\n============================================================"
              );
              console.log("检测到 DNS 验证步骤");
              console.log(
                "============================================================\n"
              );
              console.log(`记录名: ${recordName}`);
              console.log(`TXT 值: ${txtRecordValue}`);
              console.log(`TXT 值长度: ${txtRecordValue.length} 字符\n`);

              try {
                // 再次验证令牌格式
                const isValidToken = /^[A-Za-z0-9_\-+/=]{40,50}$/.test(
                  txtRecordValue
                );
                if (!isValidToken) {
                  throw new Error(`提取的 TXT 值格式不正确: ${txtRecordValue}`);
                }

                if (useAliyunDNS) {
                  // 自动更新阿里云 DNS
                  console.log("正在自动更新阿里云 DNS 记录...");
                  await this.updateDNSTXTRecord(domain, txtRecordValue);

                  // 等待 DNS 记录生效
                  console.log("\n等待 DNS 记录生效（这可能需要几分钟）...");
                  await this.checkDNSRecordPropagation(domain, txtRecordValue);

                  console.log("\n✓ DNS 记录已更新并生效，自动继续验证...\n");
                } else {
                  // 手动模式：等待用户确认
                  console.log("请在 DNS 服务商处添加上述 TXT 记录");
                  console.log("添加完成后，按 Enter 继续...\n");
                }

                // 发送回车以继续
                certbotProcess.stdin.write("\n");
              } catch (error) {
                console.error("✗ 处理 DNS 记录时出错:", error.message);
                certbotProcess.kill();
                reject(error);
              }
            }
          }
        });

        // 处理标准错误
        certbotProcess.stderr.on("data", (data) => {
          const text = data.toString();
          outputBuffer += text;
          process.stderr.write(text);

          // 检测是否出现"已有证书"提示
          if (
            !hasExistingCertPrompt &&
            (text.includes("existing certificate") ||
              text.includes("has exactly the same domains") ||
              text.includes("What would you like to do?"))
          ) {
            hasExistingCertPrompt = true;
            console.log(
              "\n检测到已有有效证书提示，自动选择保留现有证书 (选项 1)...\n"
            );
            // 发送 "1" 选择保留现有证书
            certbotProcess.stdin.write("1\n");
          }

          // 同样检查 stderr 中的 TXT 记录值（certbot 可能输出到 stderr）
          if (text.includes("with the following value:") && !waitingForDNS) {
            const lines = text.split("\n");

            // 查找记录名
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes("_acme-challenge")) {
                recordName = lines[i].trim();
                break;
              }
            }

            // 查找 TXT 值
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes("with the following value:")) {
                for (let j = i + 1; j < lines.length; j++) {
                  const trimmed = lines[j].trim();
                  // 验证令牌特征：Base64 编码，长度 40-50 字符
                  const isValidToken = /^[A-Za-z0-9_\-+/=]{40,50}$/.test(
                    trimmed
                  );
                  if (isValidToken) {
                    txtRecordValue = trimmed;
                    break;
                  }
                }
                break;
              }
            }
          }
        });

        // 处理需要用户输入的情况
        certbotProcess.stdin.on("error", (error) => {
          // 忽略 stdin 错误
        });

        certbotProcess.on("close", (code) => {
          if (code === 0) {
            console.log("\n✓ 证书生成成功!");
            resolve(true);
          } else {
            reject(new Error(`certbot 执行失败，退出码: ${code}`));
          }
        });

        certbotProcess.on("error", (error) => {
          reject(new Error(`启动 certbot 失败: ${error.message}`));
        });
      });
    } catch (error) {
      console.error("✗ 证书生成失败:", error.message);
      throw error;
    }
  }

  /**
   * 自动查找 certbot 生成的证书路径
   * @param {string} domain - 域名（不含通配符）
   */
  async findCertbotCertPath(domain) {
    const basePath = DEFAULT_CERTBOT_PATH;
    const certPath = path.join(basePath, domain, DEFAULT_CERTBOT_CERT_FILE);
    const keyPath = path.join(basePath, domain, DEFAULT_CERTBOT_KEY_FILE);

    try {
      // 检查证书和私钥文件是否存在，且当前进程是否有权限访问它
      await fs.access(certPath);
      await fs.access(keyPath);

      console.log(`✓ 找到证书文件:`);
      console.log(`  证书: ${certPath}`);
      console.log(`  私钥: ${keyPath}`);

      return { certPath, keyPath };
    } catch (error) {
      console.warn(`⚠ 未找到证书文件在默认路径: ${basePath}/${domain}`);
      return null;
    }
  }

  /**
   * 检查证书是否存在且有效
   * @param {string} domain - 域名
   * @param {number} daysBeforeExpiry - 过期前多少天认为需要更新（默认3天）
   * @returns {Object|null} 返回证书信息或 null
   */
  async checkCertificateValidity(
    domain,
    daysBeforeExpiry = DEFAULT_DAYS_BEFORE_EXPIRY
  ) {
    try {
      const certPaths = await this.findCertbotCertPath(domain);
      if (!certPaths) {
        console.log(`✗ 未找到域名 ${domain} 的证书`);
        return null;
      }

      // 使用 openssl 检查证书有效期，只输出过期时间不把pem编译原文件输出
      const { stdout } = await execAsync(
        `openssl x509 -in ${certPaths.certPath} -noout -enddate`
      );
      const expiryMatch = stdout.match(/notAfter=(.*)/);

      if (!expiryMatch) {
        console.warn("⚠ 无法解析证书过期时间");
        return null;
      }

      const expiryDate = new Date(expiryMatch[1]);
      const now = new Date();
      const daysRemaining = Math.floor(
        (expiryDate - now) / (1000 * 60 * 60 * 24)
      );

      console.log(`\n证书有效期检查:`);
      console.log(`  域名: ${domain}`);
      console.log(`  过期时间: ${expiryDate.toLocaleString("zh-CN")}`);
      console.log(`  剩余天数: ${daysRemaining} 天`);

      if (daysRemaining > daysBeforeExpiry) {
        console.log(
          `✓ 证书仍然有效（剩余 ${daysRemaining} 天，阈值 ${daysBeforeExpiry} 天）`
        );
        return {
          valid: true,
          expiryDate,
          daysRemaining,
          certPath: certPaths.certPath,
          keyPath: certPaths.keyPath,
        };
      } else {
        console.log(
          `⚠ 证书即将过期（剩余 ${daysRemaining} 天，阈值 ${daysBeforeExpiry} 天）`
        );
        return {
          valid: false,
          expiryDate,
          daysRemaining,
          certPath: certPaths.certPath,
          keyPath: certPaths.keyPath,
        };
      }
    } catch (error) {
      console.log(`✗ 检查证书有效期失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 读取证书文件内容
   * 如果文件路径为 'auto'，则自动从 certbot 默认路径查找
   */
  async readCertificateFile(filePath, domain = "") {
    try {
      // 如果指定为 'auto'，尝试自动查找 certbot 证书
      if (filePath === "auto" && domain) {
        const certPaths = await this.findCertbotCertPath(domain);
        if (certPaths) {
          filePath = certPaths.certPath;
        } else {
          throw new Error(`无法自动找到域名 ${domain} 的证书文件`);
        }
      }

      const content = await fs.readFile(filePath, "utf-8");
      return content.trim();
    } catch (error) {
      throw new Error(`读取证书文件失败 ${filePath}: ${error.message}`);
    }
  }

  /**
   * 读取私钥文件内容
   * 如果文件路径为 'auto'，则自动从 certbot 默认路径查找
   */
  async readPrivateKeyFile(filePath, domain = "") {
    try {
      // 如果指定为 'auto'，尝试自动查找 certbot 私钥
      if (filePath === "auto" && domain) {
        const certPaths = await this.findCertbotCertPath(domain);
        if (certPaths) {
          filePath = certPaths.keyPath;
        } else {
          throw new Error(`无法自动找到域名 ${domain} 的私钥文件`);
        }
      }

      const content = await fs.readFile(filePath, "utf-8");
      return content.trim();
    } catch (error) {
      throw new Error(`读取私钥文件失败 ${filePath}: ${error.message}`);
    }
  }

  /**
   * 生成证书配置 XML 文件
   */
  async generateCertificateXML(
    domain,
    certId,
    certificate,
    privateKey,
    previousCertId = "",
    force = true
  ) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<BucketCnameConfiguration>
  <Cname>
    <Domain>${domain}</Domain>
    <CertificateConfiguration>
      ${certId ? `<CertId>${certId}</CertId>` : ""}
      <Certificate>${certificate}</Certificate>
      <PrivateKey>${privateKey}</PrivateKey>
      ${
        previousCertId
          ? `<PreviousCertId>${previousCertId}</PreviousCertId>`
          : ""
      }
      <Force>${force}</Force>
    </CertificateConfiguration>
  </Cname>
</BucketCnameConfiguration>`;

    await fs.writeFile(this.tempXmlFile, xml, "utf-8");
    console.log(`✓ 已生成证书配置文件: ${this.tempXmlFile}`);
    console.log(`  文件大小: ${xml.length} 字符`);

    // 验证文件是否成功写入
    try {
      await fs.access(this.tempXmlFile);
      const stat = await fs.stat(this.tempXmlFile);
      console.log(`  文件确认存在，大小: ${stat.size} 字节`);
    } catch (error) {
      throw new Error(`生成的 XML 文件无法访问: ${error.message}`);
    }
  }

  /**
   * 更新证书
   * @param {string} bucket - OSS Bucket 名称
   * @param {string} domain - 域名
   * @param {string} certPath - 证书文件路径
   * @param {string} keyPath - 私钥文件路径
   * @param {string} certId - 证书 ID
   * @param {string} previousCertId - 上一个证书 ID
   * @param {boolean} generateCert - 是否生成证书
   * @param {boolean} isWildcard - 是否为泛域名
   * @param {string} email - 邮箱地址
   * @param {boolean} useAliyunDNS - 是否使用阿里云 DNS 自动更新
   * @param {boolean} forceRenewal - 是否强制重新生成证书
   * @param {number} daysBeforeExpiry - 证书过期前多少天开始更新
   * @returns {boolean} 是否成功更新证书
   * @throws {Error} 如果更新证书失败
   */
  async updateCertificate(
    bucket,
    domain,
    certPath,
    keyPath,
    certId = "",
    previousCertId = "",
    generateCert = false,
    isWildcard = false,
    email = "",
    useAliyunDNS = false,
    forceRenewal = false,
    daysBeforeExpiry = DEFAULT_DAYS_BEFORE_EXPIRY
  ) {
    try {
      console.log(`\n开始更新域名 ${domain} 的 SSL 证书...`);

      // 测试 OSS 连接
      const connectionOk = await this.testOssConnection(bucket);
      if (!connectionOk) {
        console.warn("⚠ OSS 连接测试失败，但将继续尝试更新证书...");
      }

      // 如果需要生成证书
      if (generateCert) {
        const certbotInstalled = await this.checkCertbotInstalled();
        if (!certbotInstalled) {
          throw new Error("certbot 未安装，无法生成证书");
        }

        // 检查现有证书是否有效（除非强制更新）
        let shouldGenerateNewCert = forceRenewal;

        if (!forceRenewal) {
          console.log("\n检查现有证书...");
          const certInfo = await this.checkCertificateValidity(
            domain,
            daysBeforeExpiry
          );

          if (certInfo && certInfo.valid) {
            console.log(`✓ 发现有效证书，将直接使用现有证书`);
            console.log(`  证书路径: ${certInfo.certPath}`);
            console.log(`  私钥路径: ${certInfo.keyPath}`);

            // 使用现有证书路径
            certPath = certInfo.certPath;
            keyPath = certInfo.keyPath;
            shouldGenerateNewCert = false;
          } else if (certInfo && !certInfo.valid) {
            console.log(
              `⚠ 证书即将过期（剩余 ${certInfo.daysRemaining} 天），需要更新`
            );
            shouldGenerateNewCert = true;
          } else {
            console.log("✗ 未找到有效证书，需要生成新证书");
            shouldGenerateNewCert = true;
          }
        } else {
          console.log("⚠ 强制更新模式：将重新生成证书");
        }

        // 只有在需要时才生成新证书
        if (shouldGenerateNewCert) {
          console.log("\n开始生成新证书...");
          await this.generateCertificate(
            domain,
            isWildcard,
            email,
            useAliyunDNS
          );

          // 如果证书路径是 auto，自动查找
          if (certPath === "auto" || keyPath === "auto") {
            const certPaths = await this.findCertbotCertPath(domain);
            if (certPaths) {
              certPath = certPaths.certPath;
              keyPath = certPaths.keyPath;
            }
          }
        }
      }

      // 读取证书和私钥
      console.log("正在读取证书文件...");
      const certificate = await this.readCertificateFile(certPath, domain);
      const privateKey = await this.readPrivateKeyFile(keyPath, domain);

      console.log(`✓ 证书文件读取成功 (长度: ${certificate.length} 字符)`);
      console.log(`✓ 私钥文件读取成功 (长度: ${privateKey.length} 字符)`);

      // 生成配置文件
      await this.generateCertificateXML(
        domain,
        certId,
        certificate,
        privateKey,
        previousCertId,
        true
      );

      // 执行更新命令
      const cmd = this.buildOssutilCommand(
        `bucket-cname --method put --item certificate oss://${bucket} ${this.tempXmlFile}`
      );

      console.log("正在执行证书更新...");
      // 打印命令（隐藏敏感信息）
      const safeCmd = cmd.replace(/-k\s+\S+/, "-k ****");
      console.log("执行命令:", safeCmd);

      try {
        // 执行 ossutil 命令，最大缓冲区大小为 10MB，在这里由于证书不算大，所以设置为 10MB
        const { stdout, stderr } = await execAsync(cmd, {
          maxBuffer: MAX_BUFFER_SIZE,
        });

        console.log("✓ 证书更新成功!");
        if (stdout) console.log(stdout);
        if (stderr) console.warn("警告:", stderr);
      } catch (error) {
        console.error("命令执行失败:");
        console.error("退出码:", error.code);
        console.log("错误信息:", error);
        if (error.stdout) console.error("标准输出:", error.stdout);
        if (error.stderr) console.error("错误输出:", error.stderr);
        throw error;
      }

      return true;
    } catch (error) {
      console.error("✗ 证书更新失败:", error.message);
      throw error;
    } finally {
      // 清理临时文件
      await this.cleanupTempFiles();
    }
  }

  /**
   * 构建 ossutil 命令
   */
  buildOssutilCommand(baseCmd) {
    const { accessKeyId, accessKeySecret, endpoint } = this.config;

    let cmd = `ossutil ${baseCmd}`;

    if (endpoint) {
      // -e 指定 endpoint
      cmd += ` -e ${endpoint}`;
    }
    if (accessKeyId) {
      // -i 指定 accessKeyId
      cmd += ` -i ${accessKeyId}`;
    }
    if (accessKeySecret) {
      // -k 指定 accessKeySecret
      cmd += ` -k ${accessKeySecret}`;
    }

    // 添加详细日志级别
    cmd += " --loglevel debug";

    return cmd;
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles() {
    try {
      await fs.unlink(this.tempXmlFile);
      console.log("✓ 已清理临时文件");
    } catch (error) {
      // 忽略清理错误
    }
  }

  /**
   * 批量更新多个域名的证书
   */
  async batchUpdateCertificates(domains) {
    const results = [];

    for (const domainConfig of domains) {
      try {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`处理域名: ${domainConfig.domain}`);
        console.log("=".repeat(60));

        await this.updateCertificate(
          domainConfig.bucket,
          domainConfig.domain,
          domainConfig.certPath,
          domainConfig.keyPath,
          domainConfig.certId,
          domainConfig.previousCertId,
          domainConfig.generateCert,
          domainConfig.isWildcard,
          domainConfig.email,
          domainConfig.useAliyunDNS,
          domainConfig.forceRenewal,
          domainConfig.daysBeforeExpiry
        );

        results.push({
          domain: domainConfig.domain,
          success: true,
        });
      } catch (error) {
        results.push({
          domain: domainConfig.domain,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

export default OssCertificateManager;
