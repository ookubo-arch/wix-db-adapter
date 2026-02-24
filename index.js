const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【原点回帰・findバグ修正版】 ---");

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
        const providers = factoryResult.providers || factoryResult;

        const cleanTableName = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;

        // 1. 接続テスト
        app.post('/provision', (req, res) => res.status(200).json({}));

        // 2. テーブル一覧
        app.post('/schemas/list', async (req, res) => {
            try {
                const schemas = await providers.schemaProvider.list();
                res.status(200).json({ schemas: schemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 3. テーブル構造（名前空間の偽装維持）
        app.post('/schemas/find', async (req, res) => {
            try {
                const reqIds = req.body.schemaIds || [];
                const cleanIds = reqIds.map(cleanTableName);
                
                const allSchemas = await providers.schemaProvider.list();
                const targetSchemas = allSchemas.filter(schema => cleanIds.includes(schema.id));
                
                const resultSchemas = targetSchemas.map((schema, index) => {
                    return { ...schema, id: reqIds[index] };
                });
                res.status(200).json({ schemas: resultSchemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 4. データ件数カウント（成功済みのロジック）
        app.post('/data/count', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                const filter = req.body.filter || {};
                
                const countResult = await providers.dataProvider.count(cleanName, filter);
                res.status(200).json({ totalCount: countResult.totalCount || countResult || 0 });
            } catch (e) {
                console.error("‼️ /data/count エラー:", e.message);
                res.status(500).json({ error: e.message });
            }
        });

        // 5. 🌟 データの中身（ここで起きていた map エラーを解決！） 🌟
        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                
                // 【修正ポイント】ドライバーが map でクラッシュしないよう、常に配列とオブジェクトを保証する
                const filter = req.body.filter || {};
                const sort = Array.isArray(req.body.sort) ? req.body.sort : []; 
                const skip = req.body.skip || 0;
                const limit = req.body.limit || 50;

                const data = await providers.dataProvider.find(cleanName, filter, sort, skip, limit);
                
                const items = data && data.items ? data.items : (Array.isArray(data) ? data : []);
                res.status(200).json({
                    items: items,
                    totalCount: items.length
                });
            } catch (e) {
                console.error("‼️ /data/find エラー:", e.message);
                res.status(500).json({ error: e.message });
            }
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 findバグ修正版アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
