const { Pool } = require("pg");
const { ethers } = require("ethers");
const { createApp, SCHEMA } = require("./app");
const { address } = require("../deployment.json");

const env = process.env;
for (const k of ["DATABASE_URL", "DATA_KEY", "SESSION_SECRET"]) if (!env[k]) throw new Error(`Missing ${k} in .env`);

const pool = new Pool({ connectionString: env.DATABASE_URL });
const provider = new ethers.JsonRpcProvider(env.RPC_URL || "http://127.0.0.1:8545", undefined, { staticNetwork: true });

pool.query(SCHEMA).then(() => {
  const app = createApp({ pool, provider, contractAddress: address, dataKey: env.DATA_KEY, sessionSecret: env.SESSION_SECRET });
  const port = env.PORT || 4000;
  app.listen(port, () => console.log(`MediChain API on http://localhost:${port} (contract ${address})`));
});
