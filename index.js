const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【原因解析・フルログ出力版】 ---");

    // 🌟🌟🌟 【ログ解析ミドルウェア】リクエストとレスポンスをすべて監視 🌟🌟🌟
    app.use((req, res, next) => {
        console.log(`\n=========================================`);
        console.log(`📥 [Wixから着信] ${req.method} ${req.path}`);
        
        // Wixから送られてきた条件（JSON）をすべて表示
        if (req.body && Object.keys(req.body).length > 0) {
            console.log(`📦 [リクエスト内容]:`, JSON.stringify(req.body, null, 2));
        }

        const originalJson = res.json;
        res.json = function(body) {
            console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}`);
            
            // エラー時（400以上）は、エラーの詳しい中身をログに出力！
            if (res.statusCode >= 400) {
                console.error(`‼️ [エラー詳細]:`, JSON.stringify(body, null, 2));
            } else if (req.path.includes('/count') || req.path.includes('/find')) {
                // countやfindの成功時も、件数などを出力
                console.log(`📊 [返信データ(一部)]:`, JSON.stringify(body, null, 2).substring(0, 300) + ' ...');
            }
            return originalJson.call(this, body);
        };
        next();
    });

    // 🌟 【データ処理用フィルター】名前空間の切り落とし
    app.use((req, res, next) => {
        const stripPrefix = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;
        if (req.body) {
            // V2・V3両方の仕様に対応できるよう、考えられる全ての名前変数を綺麗にする
            if (req.body.collectionName) req.body.collectionName = stripPrefix(req.body.collectionName);
            if (req.body.collectionId) req.body.collectionId = stripPrefix(req.body.collectionId);
            if (req.body.collection) req.body.collection = stripPrefix(req.body.collection);
        }
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

        // 🌟🌟🌟 【手動処理ゾーン】接続維持・スキーマ用 🌟🌟🌟
        app.post('/provision', (req, res) => res.status(200).json({}));

        app.post('/schemas/list', async (req, res) => {
            try {
                const schemas = await providers.schemaProvider.list();
                res.status(200).json({ schemas: schemas });
            } catch (e) {
                console.error("‼️ [/schemas/list でエラー]:", e);
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/schemas/find', async (req, res) => {
            try {
                const schemaIds = req.body.schemaIds || [];
                const stripPrefix = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;
                const cleanIds = schemaIds.map(stripPrefix);
                
                const allSchemas = await providers.schemaProvider.list();
                const targetSchemas = allSchemas.filter(schema => cleanIds.includes(schema.id));
                
                const resultSchemas = targetSchemas.map((schema, index) => {
                    return { ...schema, id: schemaIds[index] };
                });

                res.status(200).json({ schemas: resultSchemas });
            } catch (e) {
                console.error("‼️ [/schemas/find でエラー]:", e);
                res.status(500).json({ error: e.message });
            }
        });

        // 🌟🌟🌟 【自動処理ゾーン】データの取得・並び替え用 🌟🌟🌟
        const externalDbRouter = new ExternalDbRouter({ connector, config, ...providers });
        app.use(externalDbRouter.router);

        // 万が一、プログラム全体がクラッシュした時の最終防衛ライン
        app.use((err, req, res, next) => {
            console.error("💥 [システムクラッシュ]:", err.message);
            console.error(err.stack);
            res.status(500).json({ error: err.message, stack: err.stack });
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 解析用フルログ版アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動時エラー:", e.message);
        process.exit(1);
    }
}

startServer();
