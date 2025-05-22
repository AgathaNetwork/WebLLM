const mysql = require('mysql2');
const util = require('util');

class SqlManager {
    constructor(config) {
        this.config = config;
        this.connection = null;
    }

    // 初始化数据库连接
    async init() {
        try {
            this.connection = mysql.createConnection({
                host: this.config.db.host,
                port: this.config.db.port,
                user: this.config.db.user,
                password: this.config.db.password,
                database: this.config.db.database
            });

            // 将 query 方法转换为 Promise
            this.query = util.promisify(this.connection.query).bind(this.connection);

            // 检查连接是否成功
            await this.checkConnection();
            console.log('Database connection initialized successfully.');
        } catch (error) {
            console.error('Failed to initialize database connection:', error.message);
            throw error;
        }
    }

    // 检查连接状态
    async checkConnection() {
        if (!this.connection) {
            throw new Error('Database connection is not initialized.');
        }

        try {
            await this.query('SELECT 1');
            console.log('Database connection is active.');
        } catch (error) {
            console.error('Database connection is inactive:', error.message);
            throw error;
        }
    }

    // 关闭数据库连接
    async close() {
        if (this.connection) {
            await util.promisify(this.connection.end).bind(this.connection)();
            console.log('Database connection closed.');
        }
    }
}

module.exports = SqlManager;