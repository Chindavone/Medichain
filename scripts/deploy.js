// Deploys MediChain to the local Hardhat node and assigns demo staff roles to Hardhat test accounts.
// Test accounts only — never reuse their keys anywhere real (SRS §9).
const fs = require("node:fs");
const hre = require("hardhat");
const { Pool } = require("pg");

const STAFF = [
  // [account index, role (1 Doctor, 2 Nurse), name, title, hospital index]
  [1, 1, "ທ່ານໝໍ ສົມພອນ ແກ້ວມະນີ", "ແພດອາຍຸລະກຳ", 0],
  [2, 1, "ທ່ານໝໍ ວິໄລພອນ ສີສຸວັນ", "ແພດ ຫູ ຄໍ ດັງ", 1],
  [3, 2, "ນາງ ດາວວອນ ພົມມະຈັນ", "ພະຍາບານ", 0],
];
const HOSPITALS = [
  ["ໂຮງໝໍມະໂຫສົດ", "ນະຄອນຫຼວງວຽງຈັນ"],
  ["ໂຮງໝໍມິດຕະພາບ", "ນະຄອນຫຼວງວຽງຈັນ"],
  ["ໂຮງໝໍເສດຖາທິລາດ", "ນະຄອນຫຼວງວຽງຈັນ"],
  ["ໂຮງໝໍແຂວງຫຼວງພະບາງ", "ຫຼວງພະບາງ"],
];

async function main() {
  const signers = await hre.ethers.getSigners();
  const mc = await (await hre.ethers.getContractFactory("MediChain")).deploy();
  await mc.waitForDeployment();
  for (const [i, role] of STAFF) await (await mc.setRole(signers[i].address, role)).wait();

  const deployment = { address: await mc.getAddress(), chainId: 31337, rpcUrl: "http://127.0.0.1:8545" };
  fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));
  fs.writeFileSync("web/src/deployment.json", JSON.stringify(deployment, null, 2));
  console.log("MediChain deployed at", deployment.address);

  const url = process.env.DATABASE_URL || "postgres://medichain:medichain@localhost:5433/medichain";
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(require("../server/app").SCHEMA);
    // A fresh chain means the old books are no longer registered — start the database fresh too.
    await pool.query("truncate audit, records, patients, staff, hospitals restart identity");
    const ids = [];
    for (const h of HOSPITALS) ids.push((await pool.query("insert into hospitals(name, province) values ($1,$2) returning id", h)).rows[0].id);
    const rows = [[signers[0].address, "ຜູ້ບໍລິຫານລະບົບ", "Admin", ids[0]], ...STAFF.map(([i, , n, t, h]) => [signers[i].address, n, t, ids[h]])];
    for (const r of rows) await pool.query("insert into staff(address, name, title, hospital_id) values ($1,$2,$3,$4)", r);
    console.log("Staff directory seeded.");
  } catch (e) {
    console.warn("Database not reachable, staff names not seeded:", e.message);
  } finally {
    await pool.end();
  }
  console.table([
    { role: "Admin / owner", account: 0, address: signers[0].address },
    ...STAFF.map(([i, , n]) => ({ role: n, account: i, address: signers[i].address })),
    { role: "Patient (demo)", account: 4, address: signers[4].address },
    { role: "Patient (demo)", account: 5, address: signers[5].address },
  ]);
}

main().catch((e) => { console.error(e); process.exit(1); });
