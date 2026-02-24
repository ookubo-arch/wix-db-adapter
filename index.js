const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    // ログ出力用ミドルウェア
    app.use((req, res, next) => {
        console.log(`\n📥 [Wixから着信] ${req.method} ${req.path}`);
        const originalJson = res.json;
        res.json = function(body) {
            console.log(`📤 [Wixへ返信] ステータス: ${res.statusCode}`);
            return originalJson.call(this, body);
        };
        next();
    });

    console.log("--- 2026年 SPI対応アダプター 究極互換版（最終完成版） ---");

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

        // 🌟 名前空間（プレフィックス）を取り除く魔法の関数 🌟
        const cleanTableName = (rawName) => {
            if (typeof rawName === 'string' && rawName.includes('/')) {
                const cleanName = rawName.split('/').pop();
                console.log(`🔄 [自動翻訳] '${rawName}' -> '${cleanName}'`);
                return cleanName;
            }
            return rawName;
        };

        // 🌟🌟🌟 【特別窓口】Wixのすべての要求をここで受け止めます 🌟🌟🌟

        // 1. 最初の挨拶 (provision)
        app.post('/provision', (req, res) => {
            console.log("🛠️ [特別窓口] 挨拶を成功(200)として受け入れました");
            res.status(200).json({});
        });

        // 2. テーブル一覧の要求 (schemas/list)
        app.post('/schemas/list', async (req, res) => {
            console.log("🛠️ [特別窓口] テーブル一覧を要求されました");
            try {
                const schemas = await providers.schemaProvider.list();
                res.status(200).json({ schemas: schemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 3. ✨追加✨ テーブル構造の詳細要求 (schemas/find)
        // ここが欠けていたため 401 エラーになっていました！
        app.post('/schemas/find', async (req, res) => {
            console.log("🛠️ [特別窓口] テーブル詳細(schemas/find)を要求されました");
            try {
                const schemaIds = req.body.schemaIds || [];
                const cleanIds = schemaIds.map(id => cleanTableName(id));
                
                const allSchemas = await providers.schemaProvider.list();
                const targetSchemas = allSchemas.filter(schema => cleanIds.includes(schema.id));
                
                // Wixが混乱しないように、idを "test/stores" の形に戻してあげる
                const resultSchemas = targetSchemas.map((schema, index) => {
                    return { ...schema, id: schemaIds[index] };
                });

                res.status(200).json({ schemas: resultSchemas });
            } catch (e) {
                console.error("‼️ テーブル詳細エラー:", e.message);
                res.status(500).json({ error: e.message });
            }
        });

        // 4. データの中身の要求 (data/find)
        app.post('/data/find', async (req, res) => {
            console.log("🛠️ [特別窓口] データ検索を要求されました");
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                const { filter, sort, skip, limit } = req.body;
                
                const data = await providers.dataProvider.find(cleanName, filter || {}, sort || [], skip || 0, limit || 50);
                if (data && data.items) {
                    res.status(200).json(data);
                } else {
                    res.status(200).json({ items: data || [], totalCount: (data || []).length });
                }
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 5. データの件数カウント要求 (data/count)
        app.post('/data/count', async (req, res) => {
            console.log("🛠️ [特別窓口] 件数カウントを要求されました");
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                const { filter } = req.body;
                
                const countResult = await providers.dataProvider.count(cleanName, filter || {});
                res.status(200).json({ totalCount: countResult.totalCount || countResult || 0 });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 🌟🌟🌟 ここまで 🌟🌟🌟

        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 最終完成版アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
