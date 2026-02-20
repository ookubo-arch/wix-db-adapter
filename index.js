const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    // 🕵️‍♂️ 【超強化版】Wixからの着信と、Wixへの返信をすべて監視する
    app.use((req, res, next) => {
        console.log(`\n📥 [Wixから着信] ${req.method} ${req.path}`);
        
        // アダプターがWixに返す内容をフック（盗聴）して表示
        const originalJson = res.json;
        res.json = function(body) {
            console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}, 理由:`, JSON.stringify(body));
            return originalJson.call(this, body);
        };
        const originalSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string') {
                console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}, 理由: ${body}`);
            }
            return originalSend.call(this, body);
        };
        next();
    });

    console.log("--- 2026年 SPI対応アダプター 最終形態（超監視版） ---");

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

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 アダプターがポート${port}で待機中。Wixとの会話をすべて監視します...`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
