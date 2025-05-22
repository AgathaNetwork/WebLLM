const express = require('express');
const app = express;
const path = require('path'); // 添加path模块
const yaml = require('js-yaml'); // 添加yaml解析模块
const fs = require('fs');

// 读取配置文件
let config;
try {
  let config;
  const configPath = path.join(__dirname, 'config.yml');
  const fileContents = fs.readFileSync(configPath, 'utf8');
  config = yaml.load(fileContents);
} catch (error) {
  console.error('Failed to load configuration:', error.message);
}

const port = config.port;

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
app.listen(port, () => {
  console.log(`Express 应用正在运行，访问地址: http://localhost:${port}`);
});