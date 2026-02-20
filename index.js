const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const { postgresFactory } = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 最終解決版 ---");

    try {
        // 1. データベース接続の作成
        console.log("DB接続を作成中...");
        const connector = await postgresFactory({ 
            connectionUri: process.env.URL 
        }, {});

        if (connector.init) {
            await connector.init();
        }

        // 2. Wixルーターの構築
        console.log("Wixルーターを構築中...");
        
        // 設定オブジェクトを作成
        const config = {
            authorization: {
                secretKey: process.env.SECRET_KEY || "1234"
            }
        };

        // 【ここが最重要修正！】
        // 引数を (connector, config) ではなく、{ connector, config } という1つのオブジェクトで渡します
        const externalDbRouter = new ExternalDbRouter({ 
            connector: connector, 
            config: config 
        });

        // 3. Expressにセット
        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 成功！アダプターがポート${port}で待機中です。`);
        });

    } catch (e) {
        console.error("‼️ 起動エラー:");
        console.error(e.message);
        // 万が一またエラーが出た時のために、ライブラリが期待している形を推測するヒント
        console.log("エラーの詳細スタック:", e.stack);
        process.exit(1);
    }
}

startServer();
