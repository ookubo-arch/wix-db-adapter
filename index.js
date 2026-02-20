const { ExternalDbServer } = require('@wix-velo/velo-external-db');
const { PostgresConfigReader } = require('@wix-velo/external-db-postgres');

console.log("Starting Wix-Postgres Adapter...");

const configReader = new PostgresConfigReader();
const server = new ExternalDbServer(configReader);

server.start();
