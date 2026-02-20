const veloDb = require('@wix-velo/velo-external-db');
const veloCore = require('@wix-velo/velo-external-db-core');
const Postgres = require('@wix-velo/external-db-postgres');

console.log("--- Wix-Postgres Adapter 最終起動プロセス ---");

try {
    // 1. パーツの抽出（最新版の構造を徹底的に探す）
    // サーバー機能を探す
    const ExternalDbServer = veloDb.ExternalDbServer || 
                             veloCore.ExternalDbServer || 
                             (veloDb.default && veloDb.default.ExternalDbServer);
    
    // Postgres接続機能を探す（先ほどのログで存在を確認済み）
    const PostgresConnector = Postgres.PostgresConnector || 
                              (Postgres.default && Postgres.default.PostgresConnector);

    if (!ExternalDbServer) throw new Error("Server部品が見つかりません");
    if (!PostgresConnector) throw new Error("Connector部品が見つかりません");

    console.log("データベース接続を準備中...");
    const connector = new PostgresConnector({
        connectionUri: process.env.URL
    });

    console.log("サーバーを初期化中...");
    // 2026年版の最新仕様に合わせた初期化
    const server = new ExternalDbServer(connector, { 
        secretKey: process.env.SECRET_KEY || "1234" 
    });

    server.start().then(() => {
        console.log("🚀 ついに成功しました！");
        console.log("Wixに貼り付けるURL: " + (process.env.RENDER_EXTERNAL_URL || "RenderのURL"));
    });

} catch (e) {
    console.error("‼️ 起動エラーが発生しました:");
    console.error(e.message);
    // 構造を詳しく表示（デバッグ用）
    console.log("VeloDb内の部品:", Object.keys(veloDb));
    process.exit(1);
}
