const { ExternalDbServer } = require('@wix-velo/velo-external-db');
const Postgres = require('@wix-velo/external-db-postgres');

console.log("--- Wix-Postgres Adapter 起動開始 ---");

// ライブラリの変更に対応するための自動選択
const PostgresConfigReader = Postgres.PostgresConfigReader || 
                             Postgres.ConfigReader || 
                             (Postgres.default && Postgres.default.PostgresConfigReader) ||
                             Postgres;

try {
    console.log("ConfigReaderを初期化中...");
    const configReader = new PostgresConfigReader();
    
    console.log("Serverを準備中...");
    const server = new ExternalDbServer(configReader);

    server.start().then(() => {
        console.log("🚀 アダプターが正常に起動しました！Port: 10000");
    });
} catch (e) {
    console.error("‼️ 起動に失敗しました。以下の情報を教えてください:");
    console.error(e.message);
    process.exit(1);
}
