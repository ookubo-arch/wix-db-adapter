const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【動的ページ対応・最終版】 ---");

    const SECRET_KEY = process.env.SECRET_KEY;
    if (!SECRET_KEY) {
        console.error("‼️ 致命的エラー: SECRET_KEYが設定されていません。");
        process.exit(1);
    }

    // 認証関所
    const authMiddleware = (req, res, next) => {
        const providedKey = req.body?.requestContext?.settings?.secretKey;
        if (providedKey === SECRET_KEY) {
            next();
        } else {
            res.status(401).json({ error: "Unauthorized" });
        }
    };
    app.use(authMiddleware);

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

        // 🌟 ここが変更の肝：Wixに動的ページを認識させるスキーマ設定 🌟
        const translateSchema = (wixId, pgSchema) => {
            return {
                id: wixId,
                displayName: cleanTableName(wixId),
                // 操作権限をフルオープンに近い形で宣言
                allowedOperations: ["get", "find", "count", "query"],
                // 🚀 重要：ページングモードと読み取り専用フラグをより明示的に
                pagingMode: "offset", 
                capabilities: {
                    dataOperations: ["query", "get", "count"],
                    collectionOperations: ["readOnly"]
                },
                maxPageSize: 50,
                ttl: 3600,
                fields: pgSchema.fields.reduce((acc, f) => {
                    const fieldName = f.field || f.name;
                    if (!fieldName || fieldName === '_id') return acc;
                    acc[fieldName] = {
                        displayName: fieldName,
                        type: f.type === 'number' ? 'number' : 'text',
                        // 動的ページのURLフィルタに必要な演算子
                        queryOperators: ["eq", "ne", "contains", "hasSome"]
                    };
                    return acc;
                }, { 
                    // 🚀 _id フィールドの定義を最優先
                    "_id": { 
                        displayName: "_id", 
                        type: "text", 
                        queryOperators: ["eq", "ne", "hasSome", "contains"] 
                    } 
                })
            };
        };

        app.post('/provision', (req, res) => res.status(200).json({}));

        app.post('/schemas/list', async (req, res) => {
            try {
                const results = await providers.schemaProvider.list();
                res.status(200).json({ schemas: results.map(s => translateSchema(s.id, s)) });
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

        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                let fetchProjection = req.body.projection;
                if (!Array.isArray(fetchProjection) || fetchProjection.length === 0) {
                    const allSchemas = await providers.schemaProvider.list();
                    const tableSchema = allSchemas.find(s => cleanTableName(s.id) === cleanName);
                    fetchProjection = tableSchema?.fields?.map(f => f.field || f.name).filter(Boolean) || ['*'];
                }
                const data = await providers.dataProvider.find(
                    cleanName, req.body.filter || {}, 
                    req.body.sort || [], req.body.skip || 0, req.body.limit || 50, fetchProjection 
                );
                const rawItems = data?.items || (Array.isArray(data) ? data : []);
                const items = rawItems.map(item => ({
                    ...item,
                    _id: String(item._id || item.id || Math.random())
                }));
                res.status(200).json({ items, totalCount: data.totalCount ?? items.length });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        const port = process.env.PORT || 10000;
        app.listen(port, () => console.log(`🚀 アダプター起動中！ ポート:${port}`));
    } catch (e) {
        process.exit(1);
    }
}
startServer();
