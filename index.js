const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【取得カラム明示・安定版】 ---");

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

        // 🌟 データ取得（ここを修正） 🌟
        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                
                let fetchProjection = req.body.projection;

                // 🚀 修正ポイント: 列の指定がない（空配列など）の場合、スキーマから全カラム名を自動取得して明示的に渡す
                if (!Array.isArray(fetchProjection) || fetchProjection.length === 0) {
                    const allSchemas = await providers.schemaProvider.list();
                    const tableSchema = allSchemas.find(s => cleanTableName(s.id) === cleanName);
                    
                    if (tableSchema && tableSchema.fields) {
                        fetchProjection = tableSchema.fields.map(f => f.field || f.name).filter(Boolean);
                    } else {
                        // スキーマが取れなかった場合の最後の手段
                        fetchProjection = ['*']; 
                    }
                } else {
                    // Wixから特定の列だけ要求された場合も、_idが漏れないように追加
                    if (!fetchProjection.includes('_id')) fetchProjection.push('_id');
                    if (!fetchProjection.includes('id')) fetchProjection.push('id');
                }

                const data = await providers.dataProvider.find(
                    cleanName, 
                    req.body.filter || {}, 
                    Array.isArray(req.body.sort) ? req.body.sort : [], 
                    req.body.skip || 0, 
                    req.body.limit || 50, 
                    fetchProjection // 曖昧さをなくした確実な配列を渡す
                );
                
                const rawItems = data && data.items ? data.items : (Array.isArray(data) ? data : []);

                const items = rawItems.map(item => {
                    const finalItem = { ...item };
                    
                    if (item._id !== undefined && item._id !== null) {
                        finalItem._id = String(item._id);
                    } else if (item.id !== undefined && item.id !== null) {
                        finalItem._id = String(item.id);
                    } else {
                        const firstKey = Object.keys(item).find(k => k !== '_id' && k !== 'id');
                        finalItem._id = firstKey && item[firstKey] ? String(item[firstKey]) : Math.random().toString(36).substr(2, 9);
                    }
                    
                    return finalItem;
                });

                res.status(200).json({ 
                    items, 
                    totalCount: data.totalCount !== undefined ? data.totalCount : items.length 
                });
            } catch (e) {
                // ここでエラー内容をサーバーのログに出力
                console.error("[find Error]", e.message);
                res.status(500).json({ error: e.message });
            }
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => console.log(`🚀 取得カラム明示・安定版アダプター起動中！ ポート:${port}`));

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}
startServer();
