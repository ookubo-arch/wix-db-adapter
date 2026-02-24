const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

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

    console.log("--- 2026年 SPI対応アダプター ハイブリッド完全版 ---");

    // 🌟 【データ処理用フィルター】
    // Wixから送られてくる "test/stores" などの要求のうち、データ検索の宛先だけを綺麗にします
    app.use((req, res, next) => {
        const stripPrefix = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;
        if (req.body && req.body.collectionName) {
            req.body.collectionName = stripPrefix(req.body.collectionName);
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
        // Wixとの「接続」を維持するため、IDのプレフィックスをWixの希望通りに返す窓口です

        app.post('/provision', (req, res) => {
            res.status(200).json({});
        });

        app.post('/schemas/list', async (req, res) => {
            try {
                const schemas = await providers.schemaProvider.list();
                res.status(200).json({ schemas: schemas });
            } catch (e) {
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
                
                // 【超重要】Wixが接続を切らないように、要求された通りのID（test/stores）で返す！
                const resultSchemas = targetSchemas.map((schema, index) => {
                    return { ...schema, id: schemaIds[index] };
                });

                res.status(200).json({ schemas: resultSchemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 🌟🌟🌟 【自動処理ゾーン】データの取得・並び替え用 🌟🌟🌟
        // 複雑な条件検索(filter/sort)は、Wix公式の優秀なルーターにすべて任せます
        const externalDbRouter = new ExternalDbRouter({ connector, config, ...providers });
        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 ハイブリッド完全版アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
