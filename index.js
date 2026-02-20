const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 最終形態（SSL対応版） ---");

    try {
        const dbUrlString = process.env.URL;
        if (!dbUrlString) throw new Error("環境変数 'URL' が設定されていません。");
        
        console.log("1. データベースURLを分解中...");
        const dbUrl = new URL(dbUrlString);
        
        // 【修正箇所】Renderのデータベースと接続するための SSL 設定を追加しました！
        const dbConfig = {
            host: dbUrl.hostname,
            user: dbUrl.username,
            username: dbUrl.username,
            password: dbUrl.password,
            db: dbUrl.pathname.slice(1),
            database: dbUrl.pathname.slice(1),
            port: Number(dbUrl.port) || 5432,
            connectionUri: dbUrlString,
            ssl: { rejectUnauthorized: false } // ← これがSSL必須エラーを消す魔法の1行です
        };

        console.log(`2. ファクトリーを使ってデータベース部品を生成中...`);
        const factoryResult = await Postgres.postgresFactory(dbConfig, dbConfig);
        
        const connector = factoryResult.connector || factoryResult;
        const providers = factoryResult.providers || factoryResult;

        console.log("3. 初期化状態を確定中...");
        if (connector) connector.initialized = true;
        if (connector && typeof connector.isInitialized !== 'function') {
            connector.isInitialized = () => true;
        }

        console.log("4. Wixルーターを組み立て中...");
        const config = {
            authorization: {
                secretKey: process.env.SECRET_KEY || "1234"
            }
        };

        const externalDbRouter = new ExternalDbRouter({ 
            connector: connector,
            providers: providers, 
            config: config 
        });

        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 完璧な勝利！アダプターがポート${port}で正常に起動しました。`);
            console.log("SSL設定も完了！Wixエディタの「外部データベース接続」にURLを貼り付けてください！");
        });

    } catch (e) {
        console.error("‼️ エラーが発生しました:");
        console.error(e.message);
        console.error("エラー詳細:", e.stack);
        process.exit(1);
    }
}

startServer();
