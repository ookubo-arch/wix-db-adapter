const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const { postgresFactory } = require('@wix-velo/external-db-postgres');

async function startServer() {
    const app = express();
    app.use(express.json());

    console.log("--- 2026年 SPI対応アダプター 最終起動プロセス ---");

    try {
        // 1. データベース接続
        console.log("データベースの準備中...");
        const connector = await postgresFactory({ 
            connectionUri: process.env.URL 
        }, {});

        if (connector.init) {
            await connector.init();
        }

        // 2. Wixルーターの構築
        console.log("Wixルーターを構築中...");
        
        // 最新版は config.authorization.secretKey という二重構造を求めます
        const config = {
            authorization: {
                secretKey: process.env.SECRET_KEY || "1234"
            }
        };

        const externalDbRouter = new ExternalDbRouter(connector, config);

        // 3. Expressにセット
        app.use(externalDbRouter.router);

        const port = process.env.PORT || 10000;
        app.listen(port, () => {
            console.log(`🚀 ついに、ついに成功です！ポート${port}で待機中。`);
            console.log("RenderのURLをコピーしてWixに貼り付けてください。");
        });

    } catch (e) {
        console.error("‼️ 起動エラーが発生しました:");
        console.error(e.message);
        process.exit(1);
    }
}

startServer();
