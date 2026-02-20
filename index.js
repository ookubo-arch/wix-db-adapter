const veloDb = require('@wix-velo/velo-external-db');
const veloCore = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

console.log("--- 2026年版 Wix-Postgres 最終接続プロセス ---");

try {
    // 1. パーツの抽出（最新の構造に対応）
    const ExternalDbServer = veloDb.ExternalDbServer || veloCore.ExternalDbServer;
    const PostgresConnector = Postgres.PostgresConnector;

    if (!ExternalDbServer || !PostgresConnector) {
        throw new Error("必要な部品（ServerまたはConnector）が見つかりません。");
    }

    // 2. 接続設定の構築
    console.log("データベースに接続中...");
    const connector = new PostgresConnector({
        connectionUri: process.env.URL // Renderの環境変数からURLを読み込む
    });

    // 3. サーバーの起動
    console.log("サーバーを初期化中...");
    const server = new ExternalDbServer(connector, { 
        secretKey: process.env.SECRET_KEY || "1234" 
    });

    server.start().then(() => {
        console.log("🚀 ロケット発射成功！Wixと繋がる準備が整いました。");
        console.log("URL: " + process.env.RENDER_EXTERNAL_URL);
    });

} catch (e) {
    console.error("‼️ 致命的なエラー:");
    console.error(e.message);
    process.exit(1);
}
