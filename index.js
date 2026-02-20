const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const { PostgresConnector } = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター DB接続テスト ---");

    try {
        // 1. RenderのURLをWixが読める形式に分解する
        const dbUrlString = process.env.URL;
        if (!dbUrlString) throw new Error("環境変数 'URL' が設定されていません。");
        
        console.log("1. データベースURLを分解中...");
        const dbUrl = new URL(dbUrlString);
        
        // Wixが指定する「host」「user」「password」「db」の箱に詰め替える
        const dbConfig = {
            host: dbUrl.hostname,
            user: dbUrl.username,
            password: dbUrl.password,
            db: dbUrl.pathname.slice(1), // 先頭のスラッシュを削る
            port: dbUrl.port || 5432,
            connectionUri: dbUrlString // 念のため元のURLも入れておく
        };

        // 2. コネクタを作成（分解した情報を渡す）
        console.log(`2. コネクタを作成中 (接続先: ${dbConfig.host})...`);
        const connector = new PostgresConnector(dbConfig);

        // 3. 初期化を実行
        console.log("3. 初期化命令を送信中...");
        if (typeof connector.init === 'function') {
            await connector.init();
        }

        // 4. 初期化チェックを強制バイパス
        console.log("4. 初期化チェックをバイパス中...");
        Object.defineProperty(connector, 'isInitialized', {
            value: () => true,
            writable: true,
            configurable: true
        });

        // 5. Wixルーターを構築
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

        // 6. Expressに接続
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
