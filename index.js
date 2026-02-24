const express = require('express');
const Postgres = require('@wix-velo/external-db-postgres'); // 公式ルーターは削除し、DB接続機能だけを使います

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 【原点回帰・完全手動コントロール版】 ---");

    // ログ出力用（エラーの可視化）
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

        // データベース接続プロバイダーの初期化
        const factoryResult = await Postgres.postgresFactory(dbConfig, dbConfig);
        const providers = factoryResult.providers || factoryResult;

        // 名前空間（test/）を切り落とすヘルパー関数
        const cleanTableName = (name) => typeof name === 'string' && name.includes('/') ? name.split('/').pop() : name;

        // 🌟🌟🌟 【完全手動ルーティング】認証を無視し、データだけを純粋に返す 🌟🌟🌟

        // 1. 接続テスト (プロビジョニング)
        app.post('/provision', (req, res) => {
            res.status(200).json({});
        });

        // 2. テーブル一覧の取得
        app.post('/schemas/list', async (req, res) => {
            try {
                const schemas = await providers.schemaProvider.list();
                res.status(200).json({ schemas: schemas });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 3. テーブル構造の詳細取得（接続維持のため Wix の要求名をそのまま返す）
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

        // 4. データ件数カウント（過去に成功実績のあるコードを復活）
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

        // 5. データ中身の検索（一番最初の WDE0116 エラーの原因を潰した強化版）
        app.post('/data/find', async (req, res) => {
            try {
                const cleanName = cleanTableName(req.body.collectionName);
                const filter = req.body.filter || {};
                
                // 【超重要】Wixは並び替え(sort)を空配列 [] で送ってくることがあり、
                // これがPostgreSQL側でSQLエラー(WDE0116)を引き起こすため、undefinedに無効化します！
                let sort = req.body.sort;
                if (Array.isArray(sort) && sort.length === 0) {
                    sort = undefined;
                }
                
                const skip = req.body.skip || 0;
                const limit = req.body.limit || 50;

                const data = await providers.dataProvider.find(cleanName, filter, sort, skip, limit);
                
                // プロバイダーが返す形式のブレを吸収して安全にWixに返す
                const items = Array.isArray(data) ? data : (data.items || []);
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
            console.log(`🚀 原点回帰・完全手動コントロール版アダプターがポート${port}で待機中！`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:", e.message);
        process.exit(1);
    }
}

startServer();
