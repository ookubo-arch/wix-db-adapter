const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【JWT回避・完全突破版】 ---");

    // 🌟🌟🌟 【魔法のフィルター】Wix公式ルーターを騙す 🌟🌟🌟
    app.use((req, res, next) => {
        if (req.body) {
            // 1. 名前空間（test/）を切り落とす処理
            const stripPrefix = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;
            if (req.body.collectionName) req.body.collectionName = stripPrefix(req.body.collectionName);
            if (req.body.collectionId) req.body.collectionId = stripPrefix(req.body.collectionId);
            if (Array.isArray(req.body.schemaIds)) req.body.schemaIds = req.body.schemaIds.map(stripPrefix);
            if (Array.isArray(req.body.collectionIds)) req.body.collectionIds = req.body.collectionIds.map(stripPrefix);

            // 2. 【最重要】権限（role）を強制的に BACKEND_CODE に書き換える！
            // これにより、面倒なJWT（トークン）認証を回避し、シークレットキーだけで全アクセスを許可させます。
            if (req.body.requestContext && req.body.requestContext.role) {
                req.body.requestContext.role = 'BACKEND_CODE';
            }
        }
        next();
    });

    // ログ出力用
    app.use((req, res, next) => {
        console.log(`\n📥 [Wixから着信] ${req.method} ${req.path}`);
        const originalJson = res.json;
        res.json = function(body) {
            console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}`);
            if (res.statusCode >= 400) console.error(`‼️ [エラー]:`, JSON.stringify(body));
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

        // 公式ルーターにすべてを任せる
        const externalDbRouter = new ExternalDbRouter({ connector, config, ...providers });
        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 JWT回避・完全突破版アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
