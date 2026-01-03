#!/bin/bash

# SSL证书自动更新脚本
# 用于定时任务执行

# 加载系统环境变量，确保 PATH 包含所有必要的命令
# 这样可以确保 certbot、node 等命令都能被找到
if [ -f /etc/profile ]; then
    source /etc/profile
fi

if [ -f ~/.bash_profile ]; then
    source ~/.bash_profile
elif [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi

# 进入项目目录（请根据实际路径修改）
cd /root/autoUpdateSSL || exit 1

# 执行更新 -> 这里node可以替换成npm start，如果找不到node，可以执行which node找到对应node路径，然后执行/path/to/node index.js
node index.js >> /var/log/ssl-update.log 2>&1

# 记录执行时间
echo "执行时间: $(date)" >> /var/log/ssl-update.log
echo "----------------------------------------" >> /var/log/ssl-update.log
