const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【全カラム強制取得・完全版】 ---");

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

        // 🌟 データ取得（ここが今回の修正の肝です）🌟
        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                
                // 🚀 修正ポイント: req.body.projection を無視し、空配列 [] を渡すことで強制的に全カラム（SELECT *）を取得します
                const data = await providers.dataProvider.find(
                    cleanName, 
                    req.body.filter || {}, 
                    Array.isArray(req.body.sort) ? req.body.sort : [], 
                    req.body.skip || 0, 
                    req.body.limit || 50, 
                    []  // ← どんなリクエストが来ても全データを取得！
                );
                
                const rawItems = data && data.items ? data.items : (Array.isArray(data) ? data : []);

                const items = rawItems.map(item => {
                    const finalItem = { ...item };
                    
                    // _id の確実なマッピング（大文字小文字の揺らぎにも対応）
                    const dbIdValue = item._id !== undefined ? item._id : (item.id !== undefined ? item.id : null);
                    
                    if (dbIdValue !== null) {
                        finalItem._id = String(dbIdValue);
                    } else {
                        // DB側にidが見つからない場合の最終手段
                        const firstKey = Object.keys(item).find(k => k.toLowerCase() !== '_id' && k.toLowerCase() !== 'id');
                        finalItem._id = firstKey ? String(item[firstKey]) : Math.random().toString(36).substr(2, 9);
                    }
                    
                    return finalItem;
                });

                // デバッグ用のログを出力（サーバー側で何が取れているか確認可能にしました）
                console.log(`[find] ${cleanName} | 取得件数: ${items.length} | 先頭_id: ${items.length > 0 ? items[0]._id : 'なし'}`);

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
        app.listen(port, () => console.log(`🚀 全カラム取得・完全版アダプター起動中！ ポート:${port}`));

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}
startServer();
