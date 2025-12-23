#!/bin/bash

# SSL证书自动更新脚本
# 用于定时任务执行

# 进入项目目录（请根据实际路径修改）
cd /root/autoUpdateSSL || exit 1

# 执行更新 -> 这里node可以替换成npm start，如果找不到node，可以执行which node找到对应node路径，然后执行/path/to/node index.js
node index.js >> /var/log/ssl-update.log 2>&1

# 记录执行时间
echo "执行时间: $(date)" >> /var/log/ssl-update.log
echo "----------------------------------------" >> /var/log/ssl-update.log
