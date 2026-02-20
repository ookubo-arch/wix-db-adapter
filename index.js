const { ExternalDbServer } = require('@wix-velo/velo-external-db');
const { PostgresConfigReader } = require('@wix-velo/external-db-postgres');

console.log("--- Wix-Postgres Adapter (安定版 v2) 起動 ---");

try {
    const configReader = new PostgresConfigReader();
    const server = new ExternalDbServer(configReader);

    server.start().then(() => {
        console.log("🚀 成功！安定版アダプターが起動しました。");
    });
} catch (e) {
    console.error("起動エラー:", e.message);
    process.exit(1);
}
