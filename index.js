const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【スキーマ強制同期版】 ---");

    try {
        const dbUrlString = process.env.URL;
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

        // 🌟 スキーマ（フィールド定義）をWix用に変換する関数 🌟
        const translateSchema = (wixId, pgSchema) => {
            return {
                id: wixId, // test/table_name の形式を維持
                displayName: cleanTableName(wixId),
                allowedOperations: ["get", "find", "count"], // 読み取り専用に制限して安定化
                maxPageSize: 50,
                ttl: 3600,
                // 各カラムの定義を変換
                fields: pgSchema.fields.reduce((acc, field) => {
                    acc[field.id] = {
                        displayName: field.id,
                        type: field.type === 'number' ? 'number' : 'text', // 基本はtextかnumber
                        queryOperators: ["eq", "ne", "contains", "startsWith", "endsWith", "gt", "lt", "gte", "lte"]
                    };
                    return acc;
                }, {
                    // _id フィールドを強制的に含める
                    "_id": { displayName: "_id", type: "text", queryOperators: ["eq"] }
                })
            };
        };

        app.post('/provision', (req, res) => res.status(200).json({}));

        // 🌟 スキーマ一覧 🌟
        app.post('/schemas/list', async (req, res) => {
            try {
                const results = await providers.schemaProvider.list();
                const schemas = results.map(s => translateSchema(s.id, s));
                res.status(200).json({ schemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 🌟 スキーマ詳細（Wixが最も頻繁に呼ぶ場所） 🌟
        app.post('/schemas/find', async (req, res) => {
            try {
                const reqIds = req.body.schemaIds || [];
                const cleanIds = reqIds.map(cleanTableName);
                const allRaw = await providers.schemaProvider.list();
                
                const schemas = reqIds.map(wixId => {
                    const raw = allRaw.find(s => s.id === cleanTableName(wixId));
                    return raw ? translateSchema(wixId, raw) : null;
                }).filter(Boolean);

                res.status(200).json({ schemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/data/count', async (req, res) => {
            const cleanName = cleanTableName(req.body.collectionName);
            const countResult = await providers.dataProvider.count(cleanName, req.body.filter || {});
            res.status(200).json({ totalCount: countResult.totalCount || countResult || 0 });
        });

        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                const data = await providers.dataProvider.find(
                    cleanName, 
                    req.body.filter || {}, 
                    Array.isArray(req.body.sort) ? req.body.sort : [], 
                    req.body.skip || 0, 
                    req.body.limit || 50, 
                    Array.isArray(req.body.projection) ? req.body.projection : []
                );
                const rawItems = data && data.items ? data.items : (Array.isArray(data) ? data : []);

                const items = rawItems.map(item => {
                    // idを_idとして強制マッピング
                    const finalItem = { ...item };
                    if (item.id) finalItem._id = String(item.id);
                    else {
                        const firstKey = Object.keys(item)[0];
                        finalItem._id = String(item[firstKey]);
                    }
                    return finalItem;
                });

                res.status(200).json({ items, totalCount: items.length });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => console.log(`🚀 スキーマ同期版起動中！`));

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}
startServer();
