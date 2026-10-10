// Contract + API acceptance tests (SRS §10). API tests need Postgres: `npm run db`.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { Pool } = require("pg");
const { createApp, SCHEMA } = require("../server/app");

const CONSULT = 1, VITALS = 2, LABS = 4;

async function deploy() {
  const [owner, doctor, nurse, patient, stranger] = await ethers.getSigners();
  const mc = await (await ethers.getContractFactory("MediChain")).deploy();
  await mc.setRole(doctor.address, 1);
  await mc.setRole(nurse.address, 2);
  return { mc, owner, doctor, nurse, patient, stranger };
}
const inAnHour = async () => (await time.latest()) + 3600;

describe("MediChain contract", () => {
  it("registers a patient with a unique id", async () => {
    const { mc, patient, stranger } = await deploy();
    const id = ethers.id("MC-2026-000001");
    await expect(mc.connect(patient).registerPatient(id)).to.emit(mc, "PatientRegistered");
    await expect(mc.connect(stranger).registerPatient(id)).to.be.revertedWith("id taken");
  });

  it("only admins set roles; staff cannot register as patients", async () => {
    const { mc, doctor, stranger } = await deploy();
    await expect(mc.connect(stranger).setRole(stranger.address, 1)).to.be.revertedWith("admin only");
    await expect(mc.connect(doctor).registerPatient(ethers.id("x"))).to.be.revertedWith("staff cannot be patient");
  });

  it("AT-03/04/05: no access → grant → scoped access → revoke", async () => {
    const { mc, doctor, patient } = await deploy();
    await mc.connect(patient).registerPatient(ethers.id("p"));
    expect(await mc.hasAccess(patient.address, doctor.address, CONSULT)).to.equal(false);
    await mc.connect(patient).grantAccess(doctor.address, CONSULT | VITALS, await inAnHour());
    expect(await mc.hasAccess(patient.address, doctor.address, CONSULT)).to.equal(true);
    expect(await mc.hasAccess(patient.address, doctor.address, LABS)).to.equal(false);
    await expect(mc.connect(patient).revokeAccess(doctor.address)).to.emit(mc, "AccessRevoked");
    expect(await mc.hasAccess(patient.address, doctor.address, CONSULT)).to.equal(false);
  });

  it("grants expire", async () => {
    const { mc, doctor, patient } = await deploy();
    await mc.connect(patient).registerPatient(ethers.id("p"));
    await mc.connect(patient).grantAccess(doctor.address, CONSULT, await inAnHour());
    await time.increase(3601);
    expect(await mc.hasAccess(patient.address, doctor.address, CONSULT)).to.equal(false);
  });

  it("nobody but the patient can change their grants", async () => {
    const { mc, doctor, nurse, patient, stranger } = await deploy();
    await mc.connect(patient).registerPatient(ethers.id("p"));
    await mc.connect(patient).grantAccess(doctor.address, CONSULT, await inAnHour());
    await expect(mc.connect(stranger).revokeAccess(doctor.address)).to.be.revertedWith("no active grant");
    await expect(mc.connect(doctor).grantAccess(nurse.address, CONSULT, await inAnHour())).to.be.revertedWith("not a patient");
    await expect(mc.connect(patient).grantAccess(stranger.address, CONSULT, await inAnHour())).to.be.revertedWith("grantee is not medical staff");
  });

  it("anchors record hashes only with access; nurses only vitals", async () => {
    const { mc, doctor, nurse, patient } = await deploy();
    await mc.connect(patient).registerPatient(ethers.id("p"));
    const h = ethers.id("record");
    await expect(mc.connect(doctor).anchorRecord(patient.address, h, CONSULT)).to.be.revertedWith("no access");
    await mc.connect(patient).grantAccess(doctor.address, 7, await inAnHour());
    await mc.connect(patient).grantAccess(nurse.address, 7, await inAnHour());
    await expect(mc.connect(nurse).anchorRecord(patient.address, h, CONSULT)).to.be.revertedWith("role cannot write this");
    await expect(mc.connect(doctor).anchorRecord(patient.address, h, CONSULT)).to.emit(mc, "RecordAnchored");
    expect((await mc.anchors(h)).author).to.equal(doctor.address);
  });
});

describe("MediChain API", function () {
  let pool, server, base, ctx;

  before(async function () {
    // Separate database so tests never wipe the dev data.
    const admin = new Pool({ connectionString: "postgres://medichain:medichain@localhost:5433/medichain" });
    try {
      const { rowCount } = await admin.query("select 1 from pg_database where datname = 'medichain_test'");
      if (!rowCount) await admin.query("create database medichain_test");
    } catch { return this.skip(); } finally { await admin.end(); }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || "postgres://medichain:medichain@localhost:5433/medichain_test" });
    await pool.query("drop table if exists audit, records, patients, staff, hospitals");
    await pool.query(SCHEMA);
  });
  after(async () => { server?.close(); await pool?.end(); });

  beforeEach(async () => {
    if (!pool) return;
    await pool.query("truncate audit, records, patients, staff, hospitals restart identity");
    ctx = await deploy();
    const app = createApp({
      pool, provider: ethers.provider, contractAddress: await ctx.mc.getAddress(),
      dataKey: "11".repeat(32), sessionSecret: "test",
    });
    server?.close();
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  const call = async (path, { token, method = "GET", body } = {}) => {
    const r = await fetch(base + path, {
      method, body: body && JSON.stringify(body),
      headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    });
    return { status: r.status, body: await r.json() };
  };
  const login = async (signer) => {
    const { body } = await call("/auth/nonce", { method: "POST", body: { address: signer.address } });
    const signature = await signer.signMessage(body.message);
    return (await call("/auth/verify", { method: "POST", body: { address: signer.address, signature } })).body.token;
  };
  const openBook = async () => {
    const t = await login(ctx.patient);
    const { status, body } = await call("/patients", { token: t, method: "POST", body: { name: "ທົດລອງ ຈຳລອງ", dob: "1996-01-01" } });
    expect(status).to.equal(201); // AT-02
    await ctx.mc.connect(ctx.patient).registerPatient(ethers.id(body.pid));
    return { pid: body.pid, patientToken: t };
  };

  it("rejects a forged signature", async () => {
    const { body } = await call("/auth/nonce", { method: "POST", body: { address: ctx.patient.address } });
    const signature = await ctx.stranger.signMessage(body.message);
    const r = await call("/auth/verify", { method: "POST", body: { address: ctx.patient.address, signature } });
    expect(r.status).to.equal(401);
  });

  it("AT-03/04/05/06/10: access follows the chain on every request", async () => {
    const { pid, patientToken } = await openBook();
    const doc = await login(ctx.doctor);

    let r = await call(`/patients/${pid}`, { token: doc });
    expect(r.status).to.equal(403); // AT-03, AT-10
    expect(r.body).to.not.have.property("profile");

    await ctx.mc.connect(ctx.patient).grantAccess(ctx.doctor.address, CONSULT, await inAnHour());
    r = await call(`/patients/${pid}/records`, { token: doc, method: "POST", body: { kind: "consult", data: { symptoms: "ໄອ", diagnosis: "Rhinitis" } } });
    expect(r.status).to.equal(201);
    await ctx.mc.connect(ctx.doctor).anchorRecord(ctx.patient.address, r.body.hash, r.body.scope);
    expect(ethers.id(r.body.canonical)).to.equal(r.body.hash); // AT-07: hash recomputes from the record

    r = await call(`/patients/${pid}/records`, { token: doc, method: "POST", body: { kind: "lab", data: { HGB: "14.3" } } });
    expect(r.status).to.equal(403); // outside granted scope

    r = await call(`/patients/${pid}`, { token: doc });
    expect(r.status).to.equal(200); // AT-04
    expect(r.body.records).to.have.length(1); // AT-06
    expect(r.body.profile.name).to.equal("ທົດລອງ ຈຳລອງ");

    let recent = (await call("/recent", { token: doc })).body;
    expect(recent[0]).to.include({ pid, name: "ທົດລອງ ຈຳລອງ", writes: 1 });

    await ctx.mc.connect(ctx.patient).revokeAccess(ctx.doctor.address);
    expect((await call(`/patients/${pid}`, { token: doc })).status).to.equal(403); // AT-05
    recent = (await call("/recent", { token: doc })).body;
    expect(recent[0]).to.include({ pid, name: null, scopes: 0 }); // history stays, name hidden after revoke

    const audit = await call(`/patients/${pid}/audit`, { token: patientToken });
    expect(audit.body.map((a) => a.action)).to.include.members(["access_denied", "view_book", "add_record"]);
    expect(JSON.stringify(audit.body)).to.not.include("Rhinitis"); // FR-06: no medical detail in the log
    expect((await call(`/patients/${pid}/audit`, { token: doc })).status).to.equal(403);
  });

  it("nurses write vitals only, and only scoped records are returned", async () => {
    const { pid } = await openBook();
    await ctx.mc.connect(ctx.patient).grantAccess(ctx.nurse.address, VITALS, await inAnHour());
    const nurse = await login(ctx.nurse);
    expect((await call(`/patients/${pid}/records`, { token: nurse, method: "POST", body: { kind: "consult", data: { a: 1 } } })).status).to.equal(403);
    expect((await call(`/patients/${pid}/records`, { token: nurse, method: "POST", body: { kind: "vitals", data: { bp: "120/80" } } })).status).to.equal(201);
  });

  it("admins add hospitals and assign staff; directory returns hospital", async () => {
    const admin = await login(ctx.owner);
    const doc = await login(ctx.doctor);
    expect((await call("/hospitals", { token: doc, method: "POST", body: { name: "X" } })).status).to.equal(403);
    const h = await call("/hospitals", { token: admin, method: "POST", body: { name: "ໂຮງໝໍທົດລອງ", province: "ວຽງຈັນ" } });
    expect(h.status).to.equal(201);
    expect((await call("/hospitals", { token: admin, method: "POST", body: { name: "ໂຮງໝໍທົດລອງ" } })).status).to.equal(409);
    expect((await call(`/staff/${ctx.doctor.address}`, { token: admin, method: "PUT", body: { name: "Dr A", hospitalId: 999 } })).status).to.equal(400);
    await call(`/staff/${ctx.doctor.address}`, { token: admin, method: "PUT", body: { name: "Dr A", hospitalId: h.body.id } });
    const list = (await call("/staff", { token: doc })).body;
    expect(list[0]).to.include({ name: "Dr A", hospital: "ໂຮງໝໍທົດລອງ", role: "doctor" });
  });

  it("stores medical data encrypted at rest", async () => {
    const { pid } = await openBook();
    const { rows } = await pool.query("select profile from patients where pid = $1", [pid]);
    expect(rows[0].profile.toString("utf8")).to.not.include("ທົດລອງ");
  });
});
