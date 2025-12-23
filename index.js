#!/usr/bin/env node

/**
 * 阿里云 OSS SSL 证书自动更新工具 - 主入口文件
 * Copyright (C) 2025 xiaodaipi173
 * 
 * 本程序是自由软件：您可以根据 GNU 通用公共许可证（GPL-3.0）
 * 的条款重新分发和/或修改它。详情请参阅 LICENSE 文件。
 * 
 * 如需闭源商业授权，请联系作者：xiaodaipi173
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OssCertificateManager from "./oss-certificate-manager.js";

const __filename = fileURLToPath(import.meta.url); // es module 获取当前文件的绝对路径
export const __dirname = path.dirname(__filename);

/**
 * 主函数
 */
async function main() {
  console.log("阿里云 OSS SSL 证书自动更新工具");
  console.log("=".repeat(60));

  try {
    // 读取配置文件
    const configPath = path.join(__dirname, "config.json");
    let config;

    try {
      const configContent = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(configContent);
    } catch (error) {
      console.error("✗ 读取配置文件失败，请确保 config.json 存在");
      console.error("提示: 可以参考 config.example.json 创建配置文件");
      process.exit(1);
    }

    // 创建更新器实例
    const certificateManager = new OssCertificateManager({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: config.endpoint,
    });

    // 检查 ossutil 是否安装和版本是否兼容
    const isOSSUtilInstalled = await certificateManager.checkOSSUtilInstalled();
    if (!isOSSUtilInstalled) {
      console.error("\n请先安装 ossutil 后再运行此脚本。");
      process.exit(1);
    }

    // 批量执行域名证书更新
    if (config.domains && config.domains.length > 0) {
      console.log(`\n准备更新 ${config.domains.length} 个域名的证书...\n`);

      const results = await certificateManager.batchUpdateCertificates(
        config.domains
      );

      console.log("\n" + "=".repeat(60));
      console.log("更新结果摘要:");
      console.log("=".repeat(60));

      results.forEach((result) => {
        if (result.success) {
          console.log(`✓ ${result.domain}: 成功`);
        } else {
          console.log(`✗ ${result.domain}: 失败 - ${result.error}`);
        }
      });

      const successCount = results.filter((r) => r.success).length;
      console.log(`\n总计: ${successCount}/${results.length} 成功`);
    } else {
      console.error("✗ 配置文件中没有配置域名");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n✗ 执行失败:", error.message);
    process.exit(1);
  }
}

main();
