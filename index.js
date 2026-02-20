const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

// 🚨 【追加】沈黙のフリーズを絶対に許さない安全装置
process.on('unhandledRejection', (reason, promise) => {
    console.error('‼️ [フリーズ検知] 未処理の非同期エラー:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('‼️ [フリーズ検知] 致命的なエラー:', err.message, err.stack);
});

async function startServer() {
    const app = express();
    app.use(express.json());

    // 通信監視カメラ
    app.use((req, res, next) => {
        console.log(`\n📥 [Wixから着信] ${req.method} ${req.path}`);
        
        const originalJson = res.json;
        res.json = function(body) {
            console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}, 理由:`, JSON.stringify(body));
            return originalJson.call(this, body);
        };
        const originalSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string') {
                console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}`);
            }
            return originalSend.call(this, body);
        };
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
            console.log(`📤 [Wixへ返信 (完了)] ステータス: ${res.statusCode}`);
            return originalEnd.call(this, chunk, encoding);
        };
        next();
    });

    console.log("--- 2026年 SPI対応アダプター 最終形態（スプレッド展開版） ---");

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

        // 🛠️ 【ここが最重要修正！】
        // ...providers と書くことで、工具箱の中身（dataProvider等）を直接広げて渡します
        const externalDbRouter = new ExternalDbRouter({ 
            connector: connector,
            config: config,
            ...providers 
        });

        app.use(externalDbRouter.router);

        app.use((err, req, res, next) => {
            console.error("‼️ 内部処理エラー:", err.message);
            res.status(500).json({ error: err.message });
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 アダプターがポート${port}で待機中。`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
