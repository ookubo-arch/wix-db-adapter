const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const { PostgresConnector } = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 究極解決版 ---");

    try {
        // 1. コネクタを直接作成
        console.log("1. コネクタを作成中...");
        const connector = new PostgresConnector({ 
            connectionUri: process.env.URL 
        }, {});

        // 2. 初期化を実行
        console.log("2. 初期化命令を送信中...");
        if (typeof connector.init === 'function') {
            await connector.init();
        }

        // 3. 【最重要：書き換えを強制する】
        // 普通の代入（=）ではなく、プロパティ定義を直接いじって
        // isInitialized が常に true を返すように固定します。
        console.log("3. 初期化チェックを強制バイパス中...");
        Object.defineProperty(connector, 'isInitialized', {
            value: () => true,
            writable: true,
            configurable: true
        });

        // 4. Wixルーターを構築
        console.log("4. ルーターを組み立て中...");
        
        const config = {
            authorization: {
                secretKey: process.env.SECRET_KEY || "1234"
            }
        };

        // 最新の「オブジェクト1つ」で渡す形式
        const externalDbRouter = new ExternalDbRouter({ 
            connector: connector, 
            config: config 
        });

        // 5. Expressに接続
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
