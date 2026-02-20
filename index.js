const { ExternalDbServer } = require('@wix-velo/velo-external-db');
const Postgres = require('@wix-velo/external-db-postgres');

console.log("--- Wix-Postgres Adapter 最終起動テスト ---");

// ライブラリの中身を徹底調査して、使えるものを探す
function findConfigReader(mod) {
    if (typeof mod.PostgresConfigReader === 'function') return mod.PostgresConfigReader;
    if (typeof mod.ConfigReader === 'function') return mod.ConfigReader;
    if (mod.default && typeof mod.default.PostgresConfigReader === 'function') return mod.default.PostgresConfigReader;
    if (mod.default && typeof mod.default.ConfigReader === 'function') return mod.default.ConfigReader;
    return mod; // 最後に自分自身を試す
}

try {
    const SelectedReader = findConfigReader(Postgres);
    console.log("選択された機能のタイプ:", typeof SelectedReader);

    // new が使えない場合（ただの関数の場合）も考慮
    const configReader = (typeof SelectedReader === 'function' && SelectedReader.prototype) 
                         ? new SelectedReader() 
                         : SelectedReader;

    console.log("サーバーを起動します...");
    const server = new ExternalDbServer(configReader);

    server.start().then(() => {
        console.log("🚀 ついに成功しました！Wixからの接続を待っています。");
    });
} catch (e) {
    console.error("‼️ まだエラーが出る場合は以下を教えてください:");
    console.error(e.message);
    // ライブラリの構造をログに出力して原因を特定する
    console.log("ライブラリの中身:", Object.keys(Postgres));
    process.exit(1);
}
