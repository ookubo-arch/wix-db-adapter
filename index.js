const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    app.use((req, res, next) => {
        console.log(`\n📥 [Wixから着信] ${req.method} ${req.path}`);
        const originalJson = res.json;
        res.json = function(body) {
            console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}`);
            return originalJson.call(this, body);
        };
        next();
    });

    console.log("--- 2026年 SPI対応アダプター 究極互換版（V2/V3両対応） ---");

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

        const externalDbRouter = new ExternalDbRouter({ 
            connector, config, ...providers 
        });

        // 🌟🌟🌟 【ここが究極の解決策！】 🌟🌟🌟
        // Wixエディタ（旧規格）からの要求に、直接手動で答える「特別窓口」を作ります

        // 1. 最初の挨拶 (provision)
        app.post('/provision', (req, res) => {
            console.log("🛠️ [V2互換窓口] Wixからの挨拶を「成功(200)」として受け入れました！");
            res.status(200).json({});
        });

        // 2. テーブル一覧の要求 (schemas/list)
        app.post('/schemas/list', async (req, res) => {
            console.log("🛠️ [V2互換窓口] テーブル一覧を要求されました。Postgresから読み取ります...");
            try {
                const schemas = await providers.schemaProvider.list();
                res.status(200).json({ schemas: schemas });
            } catch (e) {
                console.error("‼️ テーブル読み取りエラー:", e.message);
                res.status(500).json({ error: e.message });
            }
        });

        // 3. データの中身の要求 (data/find)
        app.post('/data/find', async (req, res) => {
            console.log("🛠️ [V2互換窓口] データ検索を要求されました！");
            try {
                const { collectionName, filter, sort, skip, limit } = req.body;
                const data = await providers.dataProvider.find(collectionName, filter || {}, sort || [], skip || 0, limit || 50);
                if (data && data.items) {
                    res.status(200).json(data);
                } else {
                    res.status(200).json({ items: data || [], totalCount: (data || []).length });
                }
            } catch (e) {
                console.error("‼️ データ検索エラー:", e.message);
                res.status(500).json({ error: e.message });
            }
        });
        // 🌟🌟🌟 ここまで 🌟🌟🌟

        // 最新のV3ルーターも一応有効にしておく
        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 完璧な互換アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
