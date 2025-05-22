const express = require('express');
const app = express();
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const SqlManager = require('./base/SqlManager'); // 引入 SqlManager

// 读取配置文件
let config;
let sqlManager; // 定义 sqlManager 变量

async function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.yml');
    const fileContents = await fs.readFile(configPath, 'utf8');
    config = yaml.load(fileContents);
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration format');
    }
  } catch (error) {
    console.error('Failed to load configuration:', error.message);
    process.exit(1); // 如果配置加载失败，终止程序
  }
}

// 初始化数据库连接
async function initSqlConnection() {
  try {
    sqlManager = new SqlManager(config);
    await sqlManager.init();
    console.log('SQL connection initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize SQL connection:', error.message);
    process.exit(1); // 如果数据库连接初始化失败，终止程序
  }
}

(async () => {
  await loadConfig();
  await initSqlConnection(); // 在启动时初始化 SQL 连接

  const port = config.port;

  // 静态文件服务
  app.use(express.static(path.join(__dirname, 'public')));

  // 定义 /validate API
  app.post('/validate', async (req, res) => {
    const sess = req.body.sess;
    if (!sess) {
        return res.status(400).json({ status: 'pass_failed', message: 'Session parameter is missing' });
    }

    try {
        const result = await sqlManager.query('SELECT username, status, expiry FROM sessions WHERE session = ?', [sess]);
        if (result.length === 0 || result[0].status !== 1) {
            return res.json({ status: 'pass_failed' });
        }

        // 检查 expiry 是否大于当前时间戳
        const currentTime = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
        if (result[0].expiry <= currentTime) {
            return res.json({ status: 'pass_failed', message: 'Session has expired' });
        }

        return res.json({ username: result[0].username });
    } catch (error) {
        console.error('Error validating session:', error.message);
        return res.status(500).json({ status: 'pass_failed', message: 'Internal server error' });
    }
});

  // 启动服务器
  app.listen(port, () => {
    console.log(`http://localhost:${port}`);
  });
})();