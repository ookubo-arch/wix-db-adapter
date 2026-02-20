const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    // 🕵️‍♂️ 【追加】Wixからの通信を監視するログ機能
    app.use((req, res, next) => {
        console.log(`📥 [Wixから着信] ${req.method} ${req.path}`);
        next();
    });

    console.log("--- 2026年 SPI対応アダプター 最終形態（通信監視版） ---");

    try {
        const dbUrlString = process.env.URL;
        if (!dbUrlString) throw new Error("環境変数 'URL' が設定されていません。");
        
        const dbUrl = new URL(dbUrlString);
        const dbConfig = {
            host: dbUrl.hostname,
            user: dbUrl.username,
            username: dbUrl.username,
            password: dbUrl.password,
            db: dbUrl.pathname.slice(1),
            database: dbUrl.pathname.slice(1),
            port: Number(dbUrl.port) || 5432,
            connectionUri: dbUrlString,
            ssl: { rejectUnauthorized: false }
        };

        const factoryResult = await Postgres.postgresFactory(dbConfig, dbConfig);
        const connector = factoryResult.connector || factoryResult;
        const providers = factoryResult.providers || factoryResult;

        if (connector) connector.initialized = true;
        if (connector && typeof connector.isInitialized !== 'function') {
            connector.isInitialized = () => true;
        }

        const config = {
            authorization: {
                secretKey: process.env.SECRET_KEY || "1234"
            }
        };

        const externalDbRouter = new ExternalDbRouter({ 
            connector: connector,
            providers: providers, 
            config: config 
        });

        app.use(externalDbRouter.router);

        // 🚨 【追加】内部の隠れたエラーを逃さず表示する機能
        app.use((err, req, res, next) => {
            console.error("‼️ 内部処理エラー:", err.message);
            console.error(err.stack);
            res.status(500).json({ error: err.message });
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 アダプターがポート${port}で待機中。Wixからのアクセスを監視しています...`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
