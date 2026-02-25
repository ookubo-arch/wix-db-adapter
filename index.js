const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【データ取得バグ修正版】 ---");

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

        // 🌟 スキーマ変換 🌟
        const translateSchema = (wixId, pgSchema) => {
            return {
                id: wixId,
                displayName: cleanTableName(wixId),
                allowedOperations: ["get", "find", "count"],
                maxPageSize: 50,
                ttl: 3600,
                fields: pgSchema.fields.reduce((acc, f) => {
                    const fieldName = f.field || f.name;
                    if (!fieldName || fieldName === '_id') return acc;

                    acc[fieldName] = {
                        displayName: fieldName,
                        type: f.type === 'number' ? 'number' : 'text',
                        queryOperators: ["eq", "ne", "contains", "startsWith", "endsWith", "gt", "lt", "gte", "lte"]
                    };
                    return acc;
                }, {
                    "_id": { displayName: "_id", type: "text", queryOperators: ["eq", "ne", "hasSome"] }
                })
            };
        };

        app.post('/provision', (req, res) => res.status(200).json({}));

        app.post('/schemas/list', async (req, res) => {
            try {
                const results = await providers.schemaProvider.list();
                const schemas = results.map(s => translateSchema(s.id, s));
                res.status(200).json({ schemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/schemas/find', async (req, res) => {
            try {
                const reqIds = req.body.schemaIds || [];
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

        // 🌟 データ取得（バグ修正箇所） 🌟
        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                
                // 🚀 修正ポイント: Wixからのリクエストが空配列[]の場合はundefinedに変換し、全カラムを取得させる
                let fetchProjection = req.body.projection;
                if (Array.isArray(fetchProjection) && fetchProjection.length === 0) {
                    fetchProjection = undefined;
                }

                const data = await providers.dataProvider.find(
                    cleanName, 
                    req.body.filter || {}, 
                    Array.isArray(req.body.sort) ? req.body.sort : [], 
                    req.body.skip || 0, 
                    req.body.limit || 50, 
                    fetchProjection // 正しく列指定またはundefinedを渡す
                );
                
                const rawItems = data && data.items ? data.items : (Array.isArray(data) ? data : []);

                const items = rawItems.map(item => {
                    const finalItem = { ...item };
                    
                    // DBのデータから _id を探し出し、確実に文字列としてマッピングする
                    if (item._id !== undefined && item._id !== null) {
                        finalItem._id = String(item._id);
                    } else if (item.id !== undefined && item.id !== null) {
                        finalItem._id = String(item.id);
                    } else {
                        // どうしても見つからない場合のみランダムID（通常はここに落ちません）
                        finalItem._id = Math.random().toString(36).substr(2, 9);
                    }
                    
                    return finalItem;
                });

                res.status(200).json({ 
                    items, 
                    totalCount: data.totalCount !== undefined ? data.totalCount : items.length 
                });
            } catch (e) {
                console.error("[find Error]", e.message);
                res.status(500).json({ error: e.message });
            }
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => console.log(`🚀 データ取得修正版アダプター起動中！ ポート:${port}`));

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}
startServer();
