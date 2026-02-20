const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const { postgresFactory } = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 起動プロセス ---");

    try {
        // 1. データベース接続の作成
        console.log("データベースの準備中...");
        // 以前の new PostgresConnector ではなく factory を使います
        const connector = await postgresFactory({ 
            connectionUri: process.env.URL 
        }, {});

        // 2. 【最重要】初期化を待機する
        // これがないと "reading 'initialized'" エラーになります
        if (connector.init) {
            console.log("コネクタの初期化を実行中...");
            await connector.init();
        }

        // 3. Wixのルーターをセットアップ
        console.log("Wixルーターを構築中...");
        const externalDbRouter = new ExternalDbRouter(connector, { 
            secretKey: process.env.SECRET_KEY || "1234" 
        });

        app.use(externalDbRouter.router);

        // 4. サーバー開始
        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 完了！アダプターがポート${port}で正常に起動しました。`);
        });

    } catch (e) {
        console.error("‼️ 致命的なエラー:");
        console.error(e.message);
        process.exit(1);
    }
}

// 実行！
startServer();
