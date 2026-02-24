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

    console.log("--- 2026年 SPI対応アダプター 究極互換版（名前空間カット対応） ---");

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

        // 🌟🌟🌟 【追加機能】名前空間（プレフィックス）を取り除くヘルパー関数 🌟🌟🌟
        // Wixから "test/stores" と来たら "stores" に変換する魔法の関数です。
        const cleanTableName = (rawName) => {
            if (typeof rawName === 'string' && rawName.includes('/')) {
                const cleanName = rawName.split('/').pop();
                console.log(`🔄 [自動翻訳] テーブル名を '${rawName}' から '${cleanName}' に変換しました。`);
                return cleanName;
            }
            return rawName;
        };

        // 🌟🌟🌟 【特別窓口】 🌟🌟🌟

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
                // ここでヘルパー関数を使って、テーブル名を綺麗にします！
                const cleanName = cleanTableName(req.body.collectionName);
                const { filter, sort, skip, limit } = req.body;
                
                const data = await providers.dataProvider.find(cleanName, filter || {}, sort || [], skip || 0, limit || 50);
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

        // 4. ✨追加✨ データの「件数」の要求 (data/count)
        // Wixのエラーログ (operation: "count") はこれが無かったため発生していました。
        app.post('/data/count', async (req, res) => {
            console.log("🛠️ [V2互換窓口] データの件数カウントを要求されました！");
            try {
                // こちらもテーブル名を綺麗にします
                const cleanName = cleanTableName(req.body.collectionName);
                const { filter } = req.body;
                
                const countResult = await providers.dataProvider.count(cleanName, filter || {});
                res.status(200).json({ totalCount: countResult.totalCount || countResult || 0 });
            } catch (e) {
                console.error("‼️ データカウントエラー:", e.message);
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

startServer();const express = require('express');
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

    console.log("--- 2026年 SPI対応アダプター 究極互換版（名前空間カット対応） ---");

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

        // 🌟🌟🌟 【追加機能】名前空間（プレフィックス）を取り除くヘルパー関数 🌟🌟🌟
        // Wixから "test/stores" と来たら "stores" に変換する魔法の関数です。
        const cleanTableName = (rawName) => {
            if (typeof rawName === 'string' && rawName.includes('/')) {
                const cleanName = rawName.split('/').pop();
                console.log(`🔄 [自動翻訳] テーブル名を '${rawName}' から '${cleanName}' に変換しました。`);
                return cleanName;
            }
            return rawName;
        };

        // 🌟🌟🌟 【特別窓口】 🌟🌟🌟

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
                // ここでヘルパー関数を使って、テーブル名を綺麗にします！
                const cleanName = cleanTableName(req.body.collectionName);
                const { filter, sort, skip, limit } = req.body;
                
                const data = await providers.dataProvider.find(cleanName, filter || {}, sort || [], skip || 0, limit || 50);
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

        // 4. ✨追加✨ データの「件数」の要求 (data/count)
        // Wixのエラーログ (operation: "count") はこれが無かったため発生していました。
        app.post('/data/count', async (req, res) => {
            console.log("🛠️ [V2互換窓口] データの件数カウントを要求されました！");
            try {
                // こちらもテーブル名を綺麗にします
                const cleanName = cleanTableName(req.body.collectionName);
                const { filter } = req.body;
                
                const countResult = await providers.dataProvider.count(cleanName, filter || {});
                res.status(200).json({ totalCount: countResult.totalCount || countResult || 0 });
            } catch (e) {
                console.error("‼️ データカウントエラー:", e.message);
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
