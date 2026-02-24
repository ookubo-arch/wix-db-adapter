const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【強制マッピング・最終版】 ---");

    try {
        const dbUrlString = process.env.URL;
        const dbUrl = new URL(dbUrlString);
        const dbConfig = {
            host: dbUrl.hostname, user: dbUrl.username, password: dbUrl.password,
            db: dbUrl.pathname.slice(1), port: Number(dbUrl.port) || 5432,
            connectionUri: dbUrlString, ssl: { rejectUnauthorized: false }
        };

        const factoryResult = await Postgres.postgresFactory(dbConfig, dbConfig);
        const providers = factoryResult.providers || factoryResult;

        const cleanTableName = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;

        app.post('/provision', (req, res) => res.status(200).json({}));

        // スキーマ報告：Wixに「必ず _id があるよ」と嘘偽りなく報告する
        app.post('/schemas/find', async (req, res) => {
            try {
                const reqIds = req.body.schemaIds || [];
                const allRaw = await providers.schemaProvider.list();
                const schemas = reqIds.map(wixId => {
                    const raw = allRaw.find(s => s.id === cleanTableName(wixId));
                    if (!raw) return null;
                    
                    // 既存のフィールドに _id を強制追加して報告
                    const fields = { ...raw.fields.reduce((acc, f) => {
                        acc[f.id] = { displayName: f.id, type: f.type === 'number' ? 'number' : 'text' };
                        return acc;
                    }, {}) };
                    fields["_id"] = { displayName: "_id", type: "text" };

                    return { id: wixId, displayName: cleanTableName(wixId), fields };
                }).filter(Boolean);
                res.status(200).json({ schemas });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.post('/data/count', async (req, res) => {
            const count = await providers.dataProvider.count(cleanTableName(req.body.collectionName), req.body.filter || {});
            res.status(200).json({ totalCount: count.totalCount || count || 0 });
        });

        // データ返却：ここが本丸です
        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                const data = await providers.dataProvider.find(
                    cleanName, req.body.filter || {}, 
                    Array.isArray(req.body.sort) ? req.body.sort : [], 
                    req.body.skip || 0, req.body.limit || 50, 
                    Array.isArray(req.body.projection) ? req.body.projection : []
                );
                
                const rawItems = data && data.items ? data.items : (Array.isArray(data) ? data : []);

                // 🌟 超重要：全アイテムに対して _id を物理的に付与する
                const items = rawItems.map(item => {
                    const newItem = { ...item };
                    // PostgreSQLの 'id' を Wixの '_id' にコピー
                    if (item.id) {
                        newItem._id = String(item.id);
                    } else {
                        // idがない場合、最初の列の値をIDにする（苦肉の策）
                        const firstValue = Object.values(item)[0];
                        newItem._id = String(firstValue || Math.random());
                    }
                    return newItem;
                });

                console.log(`📤 ${items.length}件のデータを送信。1件目のサンプル:`, JSON.stringify(items[0]));
                res.status(200).json({ items, totalCount: items.length });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.listen(process.env.PORT || 10000);
    } catch (e) { process.exit(1); }
}
startServer();
