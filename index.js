const express = require('express');
const { ExternalDbRouter } = require('@wix-velo/velo-external-db-core');
const { PostgresConnector } = require('@wix-velo/external-db-postgres');

const app = express();
app.use(express.json());

console.log("--- 2026年版 SPI対応アダプター起動 ---");

try {
    // 1. データベース接続の準備
    const connector = new PostgresConnector({
        connectionUri: process.env.URL
    });

    // 2. Wixのルーター（脳）を作成
    // あなたのログで存在が確認された「ExternalDbRouter」を使用します
    const externalDbRouter = new ExternalDbRouter(connector, { 
        secretKey: process.env.SECRET_KEY || "1234" 
    });

    // 3. Express（体）にWixの機能をセット
    app.use(externalDbRouter.router);

    // 4. サーバー開始
    const port = process.env.PORT || 10000;
    app.listen(port, () => {
        console.log(`🚀 ついに成功！アダプターがポート${port}で待機中です。`);
        console.log("WixのエディタでURLを貼り付けてください。");
    });

} catch (e) {
    console.error("‼️ 起動に失敗しました:");
    console.error(e.message);
    process.exit(1);
}
