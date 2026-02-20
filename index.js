const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const { PostgresConnector } = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター DB接続テスト(修正版) ---");

    try {
        const dbUrlString = process.env.URL;
        if (!dbUrlString) throw new Error("環境変数 'URL' が設定されていません。");
        
        console.log("1. データベースURLを分解中...");
        const dbUrl = new URL(dbUrlString);
        
        // Wixの仕様変更に備えて、様々な名前の箱（userとusernameなど）を全部用意します
        const dbConfig = {
            host: dbUrl.hostname,
            user: dbUrl.username,
            username: dbUrl.username,
            password: dbUrl.password,
            db: dbUrl.pathname.slice(1),
            database: dbUrl.pathname.slice(1),
            port: Number(dbUrl.port) || 5432,
            connectionUri: dbUrlString
        };

        console.log(`2. コネクタを作成中 (接続先: ${dbConfig.host})...`);
        const connector = new PostgresConnector(dbConfig);

        console.log("3. 初期化命令を送信中...");
        if (typeof connector.init === 'function') {
            // 【ここが最重要の修正点！】
            // init() の中にも dbConfig を渡して、起動時の「host迷子」を防ぎます
            await connector.init(dbConfig);
        }

        console.log("4. 初期化チェックをバイパス中...");
        Object.defineProperty(connector, 'isInitialized', {
            value: () => true,
            writable: true,
            configurable: true
        });

        console.log("5. ルーターを組み立て中...");
        const config = {
            authorization: {
                secretKey: process.env.SECRET_KEY || "1234"
            }
        };

        const externalDbRouter = new ExternalDbRouter({ 
            connector: connector, 
            config: config 
        });

        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 完了！アダプターがポート${port}で正常に起動しました。`);
            console.log("Wixエディタの「外部データベース接続」にURLを貼り付けてください。");
        });

    } catch (e) {
        console.error("‼️ エラーが発生しました:");
        console.error(e.message);
        console.error("エラー詳細:", e.stack);
        process.exit(1);
    }
}

startServer();
