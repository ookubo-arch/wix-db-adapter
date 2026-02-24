const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 究極のミドルウェア版 ---");

    // 🌟🌟🌟 【ここが真の解決策】Wixの要求を前処理する「翻訳コンニャク」 🌟🌟🌟
    // Wixが "test/stores" と言ってきたら、内部の公式ルーターに渡す前に
    // こっそり "stores" に書き換えてしまう魔法のフィルターです。
    app.use((req, res, next) => {
        if (req.body) {
            const stripPrefix = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;

            if (req.body.collectionName) req.body.collectionName = stripPrefix(req.body.collectionName);
            if (req.body.collectionId) req.body.collectionId = stripPrefix(req.body.collectionId);
            if (Array.isArray(req.body.schemaIds)) req.body.schemaIds = req.body.schemaIds.map(stripPrefix);
            if (Array.isArray(req.body.collectionIds)) req.body.collectionIds = req.body.collectionIds.map(stripPrefix);
        }
        next();
    });

    // ログ出力用
    app.use((req, res, next) => {
        console.log(`\n📥 [Wixから着信] ${req.method} ${req.path}`);
        const originalJson = res.json;
        res.json = function(body) {
            console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}`);
            return originalJson.call(this, body);
        };
        next();
    });

    try {
        const dbUrlString = process.env.URL;
        if (!dbUrlString) throw new Error("環境変数 'URL' が設定されていません。");
        
        const dbUrl = new URL(dbUrlString);
        const dbConfig = {
            host: dbUrl.hostname,
            user: dbUrl.username,
            password: dbUrl.password,
            db: dbUrl.pathname.slice(1),
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
            authorization: { secretKey: process.env.SECRET_KEY || "1234" }
        };

        // 公式ルーター（並び替えやフィルターを自動処理してくれる超優秀なコア）
        const externalDbRouter = new ExternalDbRouter({ 
            connector, config, ...providers 
        });

        // 特別窓口は廃止し、すべて公式ルーターに丸投げします！
        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 究極のミドルウェア版アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
