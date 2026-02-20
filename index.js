const veloDb = require('@wix-velo/velo-external-db');
const veloCore = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

console.log("--- Wix-Postgres Adapter 最終起動プロセス(Core探索版) ---");

try {
    // 1. 部品の抽出：Core（心臓部）から直接探す
    const ExternalDbServer = veloCore.ExternalDbServer || 
                             (veloCore.default && veloCore.default.ExternalDbServer) ||
                             veloDb.ExternalDbServer;
    
    const PostgresConnector = Postgres.PostgresConnector || 
                              (Postgres.default && Postgres.default.PostgresConnector);

    // デバッグ：何が見つかったか表示
    console.log("探索結果 - Server:", typeof ExternalDbServer);
    console.log("探索結果 - Connector:", typeof PostgresConnector);

    if (typeof ExternalDbServer !== 'function') {
        // もしこれでもダメなら、Coreの中身を全部ログに出して最後の調査をする
        console.log("Core内の全部品:", Object.keys(veloCore));
        throw new Error("Server部品がどうしても見つかりません");
    }

    // 2. 接続設定
    console.log("データベース接続を準備中...");
    const connector = new PostgresConnector({
        connectionUri: process.env.URL
    });

    // 3. サーバー起動
    console.log("サーバーを初期化中...");
    const server = new ExternalDbServer(connector, { 
        secretKey: process.env.SECRET_KEY || "1234" 
    });

    server.start().then(() => {
        console.log("🚀 ついに、ついに成功しました！");
        console.log("Wixに貼り付けるURLはRenderのDashboardにあるURLです。");
    });

} catch (e) {
    console.error("‼️ エラー発生:");
    console.error(e.message);
    process.exit(1);
}
