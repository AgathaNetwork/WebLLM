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

// 新增函数：根据 name 查询 keyid
async function getKeyIdByName(name) {
  try {
    if (!sqlManager || !sqlManager.connection) {
      throw new Error('Database connection is not initialized.');
    }

    const query = 'SELECT keyid FROM aimemory WHERE name = ?';
    const [rows] = await sqlManager.query(query, [name]);

    if (rows.length > 0) {
      return rows[0].keyid;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error querying keyid:', error.message);
    throw error;
  }
}

// 新增函数：创建长期记忆体
async function createMemory(workspaceId, data) {
  try {
    if (!sqlManager || !sqlManager.connection) {
      throw new Error('Database connection is not initialized.');
    }

    const endpoint = 'bailian.cn-beijing.aliyuncs.com';
    const url = `https://${endpoint}/${workspaceId}/memories`;

    // 发起 POST 请求
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.dashscope_key}` // 假设 apiKey 存在于配置中
      }
    });

    // 解析返回结果
    const { memoryId, requestId } = response.data;

    if (!memoryId || !requestId) {
      throw new Error('Invalid response from API: memoryId or requestId is missing.');
    }

    console.log(`Memory created successfully. Memory ID: ${memoryId}, Request ID: ${requestId}`);
    return { memoryId, requestId };
  } catch (error) {
    console.error('Error creating memory:', error.message);
    throw error;
  }
}

(async () => {
  await loadConfig();
  await initSqlConnection(); // 在启动时初始化 SQL 连接

  const port = config.port;

  // 添加中间件以解析 JSON 请求体
  app.use(express.json());

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

  // 新增 axios 导入
  const axios = require('axios');

  // 修改 /chat API 来处理用户输入的消息
  app.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = config.dashscope_key;
    const appId = config.app_id;

    try {
      // 构造请求体
      const requestBody = {
        input: {
          prompt: message
        },
        parameters: {
          incremental_output: true
        },
        debug: {}
      };

      // 发起 HTTP 请求
      const response = await axios.post(`https://dashscope.aliyuncs.com/api/v1/apps/${appId}/completion`, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'enable'
        },
        responseType: 'stream' // 用于处理流式响应
      });

      if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 设置响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 处理流式响应
      response.data.on('data', (chunk) => {
        const data = chunk.toString();
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const eventData = line.substring(5);
            try {
              const parsedData = JSON.parse(eventData);
              res.write(`data: ${JSON.stringify(parsedData)}\n`);
            } catch (error) {
              console.error('Error parsing chunk:', error);
            }
          }
        }
      });

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (error) => {
        console.error('Error processing chat:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      });
    } catch (error) {
      console.error('Error processing chat:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 启动服务器
  app.listen(port, () => {
    console.log(`http://localhost:${port}`);
  });
})();

// 动态导入 node-fetch
let fetch;
(async () => {
  fetch = (await import('node-fetch')).default;
})();
