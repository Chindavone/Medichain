// MediChain API. Medical data lives here, encrypted; every read re-checks access on-chain.
const crypto = require("node:crypto");
const express = require("express");
const { ethers } = require("ethers");

const ROLES = ["none", "doctor", "nurse", "admin"];
const KIND_SCOPE = { consult: 1, vitals: 2, lab: 4 };
const PROFILE_FIELDS = ["name", "dob", "sex", "phone", "position", "ministry", "department", "division", "insuranceNo", "allergies"];
const ABI = [
  "function roleOf(address) view returns (uint8)",
  "function patientOf(bytes32) view returns (address)",
  "function hasAccess(address patient, address who, uint8 scope) view returns (bool)",
];

const SCHEMA = `
create table if not exists patients (
  pid text primary key, wallet text unique not null, profile bytea not null, created_at timestamptz default now());
create table if not exists records (
  id serial primary key, pid text not null references patients(pid), kind text not null, author text not null,
  body bytea not null, hash text unique not null, supersedes int references records(id), created_at timestamptz default now());
create table if not exists hospitals (id serial primary key, name text unique not null, province text not null default '');
create table if not exists staff (address text primary key, name text not null, title text not null default '');
alter table staff add column if not exists hospital_id int references hospitals(id);
create table if not exists audit (
  id serial primary key, at timestamptz default now(), actor text not null, action text not null, pid text, ref text);`;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function createApp({ pool, provider, contractAddress, dataKey, sessionSecret }) {
  const contract = new ethers.Contract(contractAddress, ABI, provider);
  const key = Buffer.from(dataKey, "hex");
  if (key.length !== 32) throw new Error("DATA_KEY must be 32 bytes hex");

  // AES-256-GCM at rest: iv(12) | tag(16) | ciphertext
  const encrypt = (text) => {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), ct]);
  };
  const decrypt = (buf) => {
    const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  };

  const hmac = (s) => crypto.createHmac("sha256", sessionSecret).update(s).digest("base64url");
  // ponytail: nonces in process memory — move to the DB if the API runs on more than one instance
  const nonces = new Map();
  const audit = (actor, action, pid = null, ref = null) =>
    pool.query("insert into audit(actor, action, pid, ref) values ($1,$2,$3,$4)", [actor, action, pid, ref]);

  const app = express();
  app.use(express.json({ limit: "64kb" }));
  const route = (fn) => (req, res, next) => fn(req, res).catch(next);

  function auth(req, _res, next) {
    const [payload, sig] = (req.get("authorization") || "").replace(/^Bearer /, "").split(".");
    if (!payload || !sig || hmac(payload) !== sig) return next(new HttpError(401, "ເຊື່ອມຕໍ່ Wallet ແລະເຂົ້າສູ່ລະບົບອີກຄັ້ງ."));
    const [address, exp] = Buffer.from(payload, "base64url").toString().split("|");
    if (Date.now() > Number(exp)) return next(new HttpError(401, "ໝົດເວລາເຂົ້າສູ່ລະບົບ. ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່."));
    req.address = address;
    next();
  }

  async function loadPatient(pid) {
    const { rows } = await pool.query("select * from patients where pid = $1", [pid]);
    return rows[0];
  }

  // Which scopes the caller holds right now, checked against the chain on every request.
  async function scopesFor(patient, who) {
    const checks = await Promise.all(Object.values(KIND_SCOPE).map((s) => contract.hasAccess(patient.wallet, who, s)));
    return Object.values(KIND_SCOPE).filter((_, i) => checks[i]).reduce((a, b) => a | b, 0);
  }

  async function requireAccess(req, pid) {
    const patient = pid && (await loadPatient(String(pid)));
    const scopes = patient ? await scopesFor(patient, req.address) : 0;
    if (!scopes) {
      await audit(req.address, "access_denied", patient ? patient.pid : null);
      throw new HttpError(403, "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງປຶ້ມນີ້. ໃຫ້ຄົນເຈັບເປີດສິດໃຫ້ທ່ານກ່ອນ.");
    }
    return { patient, scopes };
  }

  const recordView = (r) => ({
    id: r.id, kind: r.kind, author: r.author, hash: r.hash, supersedes: r.supersedes,
    createdAt: r.created_at, canonical: decrypt(r.body),
  });

  app.get("/api/health", route(async (_req, res) => {
    const out = { db: false, chain: false };
    try { await pool.query("select 1"); out.db = true; } catch {}
    try { out.block = await provider.getBlockNumber(); out.chain = true; } catch {}
    res.status(out.db && out.chain ? 200 : 503).json(out);
  }));

  // Sign-in with wallet: the server issues a message, the wallet signs it, we recover the signer.
  app.post("/api/auth/nonce", route(async (req, res) => {
    if (!ethers.isAddress(req.body?.address)) throw new HttpError(400, "Wallet address ບໍ່ຖືກຕ້ອງ.");
    const address = ethers.getAddress(req.body.address);
    const message = `Sign in to MediChain\nAddress: ${address}\nNonce: ${crypto.randomBytes(16).toString("hex")}`;
    nonces.set(address, { message, exp: Date.now() + 5 * 60e3 });
    res.json({ message });
  }));

  app.post("/api/auth/verify", route(async (req, res) => {
    const address = ethers.isAddress(req.body?.address) && ethers.getAddress(req.body.address);
    const pending = address && nonces.get(address);
    nonces.delete(address);
    if (!pending || pending.exp < Date.now()) throw new HttpError(400, "ຄຳຂໍເຂົ້າສູ່ລະບົບໝົດອາຍຸ. ລອງໃໝ່ອີກຄັ້ງ.");
    let signer;
    try { signer = ethers.verifyMessage(pending.message, String(req.body.signature)); } catch {}
    if (signer !== address) throw new HttpError(401, "ລາຍເຊັນບໍ່ກົງກັບ Wallet ນີ້.");
    const payload = Buffer.from(`${address}|${Date.now() + 8 * 3600e3}`).toString("base64url");
    await audit(address, "sign_in");
    res.json({ token: `${payload}.${hmac(payload)}` });
  }));

  app.get("/api/me", auth, route(async (req, res) => {
    const role = ROLES[Number(await contract.roleOf(req.address))];
    const { rows } = await pool.query("select pid from patients where wallet = $1", [req.address]);
    const pid = rows[0]?.pid ?? null;
    const registered = pid ? (await contract.patientOf(ethers.id(pid))) === req.address : false;
    const staff = (await pool.query(
      "select s.name, s.title, h.name as hospital from staff s left join hospitals h on h.id = s.hospital_id where s.address = $1",
      [req.address])).rows[0] ?? null;
    res.json({ address: req.address, role, pid, registered, staff });
  }));

  // FR-02: create the patient book. The wallet then registers keccak256(pid) on-chain.
  app.post("/api/patients", auth, route(async (req, res) => {
    if (Number(await contract.roleOf(req.address)) !== 0) throw new HttpError(403, "Wallet ຂອງບຸກຄະລາກອນບໍ່ສາມາດສ້າງປຶ້ມຄົນເຈັບໄດ້.");
    const profile = {};
    for (const f of PROFILE_FIELDS) profile[f] = String(req.body?.[f] ?? "").trim().slice(0, 200);
    if (!profile.name || !profile.dob) throw new HttpError(400, "ຕ້ອງໃສ່ຊື່ ແລະ ວັນເດືອນປີເກີດ.");
    const existing = (await pool.query("select pid from patients where wallet = $1", [req.address])).rows[0];
    if (existing) {
      await pool.query("update patients set profile = $1 where pid = $2", [encrypt(JSON.stringify(profile)), existing.pid]);
      await audit(req.address, "update_profile", existing.pid);
      return res.json({ pid: existing.pid });
    }
    for (let i = 0; i < 5; i++) {
      const pid = `MC-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
      const r = await pool.query(
        "insert into patients(pid, wallet, profile) values ($1,$2,$3) on conflict do nothing returning pid",
        [pid, req.address, encrypt(JSON.stringify(profile))]);
      if (r.rowCount) { await audit(req.address, "create_book", pid); return res.status(201).json({ pid }); }
    }
    throw new HttpError(500, "ອອກເລກປຶ້ມບໍ່ສຳເລັດ. ລອງໃໝ່ອີກຄັ້ງ.");
  }));

  // FR-03 / AT-04 / AT-10: the book, filtered to the scopes the caller holds right now.
  app.get("/api/patients/:pid", auth, route(async (req, res) => {
    const { patient, scopes } = await requireAccess(req, req.params.pid);
    const { rows } = await pool.query("select * from records where pid = $1 order by created_at, id", [patient.pid]);
    await audit(req.address, "view_book", patient.pid);
    res.json({
      pid: patient.pid, wallet: patient.wallet, scopes,
      profile: JSON.parse(decrypt(patient.profile)),
      records: rows.filter((r) => scopes & KIND_SCOPE[r.kind]).map(recordView),
    });
  }));

  app.post("/api/patients/:pid/records", auth, route(async (req, res) => {
    const { patient } = await requireAccess(req, req.params.pid);
    const kind = req.body?.kind;
    const scope = KIND_SCOPE[kind];
    if (!scope) throw new HttpError(400, "ບໍ່ຮູ້ຈັກປະເພດບັນທຶກ.");
    const role = ROLES[Number(await contract.roleOf(req.address))];
    if (!(role === "doctor" || (role === "nurse" && kind === "vitals")) || !(await contract.hasAccess(patient.wallet, req.address, scope)))
      throw new HttpError(403, "ບົດບາດ ຫຼື ສິດຂອງທ່ານບໍ່ອະນຸຍາດໃຫ້ບັນທຶກປະເພດນີ້.");
    const data = req.body?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "ບໍ່ມີຂໍ້ມູນບັນທຶກ.");
    const supersedes = req.body.supersedes ? Number(req.body.supersedes) : null;
    if (supersedes) {
      const prev = (await pool.query("select pid, kind from records where id = $1", [supersedes])).rows[0];
      if (!prev || prev.pid !== patient.pid || prev.kind !== kind) throw new HttpError(400, "ບໍ່ພົບບັນທຶກທີ່ຈະແກ້ໄຂໃນປຶ້ມນີ້.");
    }
    // The canonical string is what gets hashed and anchored; anyone holding it can verify it.
    const canonical = JSON.stringify({ v: 1, pid: patient.pid, kind, author: req.address, createdAt: new Date().toISOString(), supersedes, data });
    const hash = ethers.id(canonical);
    const { rows } = await pool.query(
      "insert into records(pid, kind, author, body, hash, supersedes) values ($1,$2,$3,$4,$5,$6) returning *",
      [patient.pid, kind, req.address, encrypt(canonical), hash, supersedes]);
    await audit(req.address, supersedes ? "correct_record" : "add_record", patient.pid, hash);
    res.status(201).json({ ...recordView(rows[0]), scope, patientWallet: patient.wallet });
  }));

  // FR-06: audit trail for the patient themself. Actors and actions only, no medical content.
  app.get("/api/patients/:pid/audit", auth, route(async (req, res) => {
    const patient = await loadPatient(req.params.pid);
    if (!patient || patient.wallet !== req.address) throw new HttpError(403, "ສະເພາະຄົນເຈັບເທົ່ານັ້ນທີ່ເບິ່ງປະຫວັດການເຂົ້າເຖິງນີ້ໄດ້.");
    const { rows } = await pool.query(
      "select a.at, a.actor, a.action, a.ref, s.name from audit a left join staff s on s.address = a.actor where a.pid = $1 order by a.at desc limit 200",
      [patient.pid]);
    res.json(rows);
  }));

  const requireAdmin = async (req) => {
    if (ROLES[Number(await contract.roleOf(req.address))] !== "admin") throw new HttpError(403, "ສະເພາະຜູ້ບໍລິຫານໂຮງໝໍ.");
  };

  app.get("/api/hospitals", auth, route(async (_req, res) => {
    res.json((await pool.query("select id, name, province from hospitals order by name")).rows);
  }));

  app.post("/api/hospitals", auth, route(async (req, res) => {
    await requireAdmin(req);
    const name = String(req.body?.name ?? "").trim().slice(0, 120);
    if (!name) throw new HttpError(400, "ຕ້ອງໃສ່ຊື່ໂຮງໝໍ.");
    const { rows } = await pool.query(
      "insert into hospitals(name, province) values ($1,$2) on conflict (name) do nothing returning id, name, province",
      [name, String(req.body?.province ?? "").trim().slice(0, 120)]);
    if (!rows[0]) throw new HttpError(409, "ມີໂຮງໝໍຊື່ນີ້ແລ້ວ.");
    await audit(req.address, "add_hospital", null, name);
    res.status(201).json(rows[0]);
  }));

  // ponytail: whole directory returned, filtered client-side — add ?q= server search when it outgrows one page
  app.get("/api/staff", auth, route(async (_req, res) => {
    const { rows } = await pool.query(
      "select s.address, s.name, s.title, s.hospital_id, h.name as hospital, h.province from staff s left join hospitals h on h.id = s.hospital_id order by s.name");
    const roles = await Promise.all(rows.map((s) => contract.roleOf(s.address)));
    res.json(rows.map((s, i) => ({ ...s, role: ROLES[Number(roles[i])] })));
  }));

  app.put("/api/staff/:address", auth, route(async (req, res) => {
    await requireAdmin(req);
    if (!ethers.isAddress(req.params.address)) throw new HttpError(400, "Wallet address ບໍ່ຖືກຕ້ອງ.");
    const name = String(req.body?.name ?? "").trim().slice(0, 120);
    if (!name) throw new HttpError(400, "ຕ້ອງໃສ່ຊື່.");
    const address = ethers.getAddress(req.params.address);
    const hospitalId = req.body?.hospitalId ? Number(req.body.hospitalId) : null;
    if (hospitalId && !(await pool.query("select 1 from hospitals where id = $1", [hospitalId])).rowCount)
      throw new HttpError(400, "ບໍ່ພົບໂຮງໝໍນີ້.");
    await pool.query(
      `insert into staff(address, name, title, hospital_id) values ($1,$2,$3,$4)
       on conflict (address) do update set name = $2, title = $3, hospital_id = $4`,
      [address, name, String(req.body?.title ?? "").slice(0, 120), hospitalId]);
    await audit(req.address, "update_staff", null, address);
    res.json({ ok: true });
  }));

  app.use((err, _req, res, _next) => {
    if (!err.status) console.error(err);
    const chainDown = err.code === "ECONNREFUSED" || err.code === "NETWORK_ERROR" || err.code === "CALL_EXCEPTION";
    res.status(err.status || (chainDown ? 503 : 500)).json({
      error: err.status ? err.message : chainDown ? "ເຊື່ອມຕໍ່ Blockchain node ບໍ່ໄດ້." : "ເກີດຂໍ້ຜິດພາດຢູ່ Server. ກວດເບິ່ງ API logs.",
    });
  });
  return app;
}

module.exports = { createApp, SCHEMA, KIND_SCOPE };
