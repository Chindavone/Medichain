import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api, assertNetwork, reader, writer, signIn, signOut, hasWallet, requestAccount, restoreSession, walletChainStatus, networkMessage, switchToHardhat,
  isRejection, txError, short, laoDate, laoDateTime, hashText, idHash, CHAIN_ID, SCOPES, ROLE_LABEL, contractAddress,
} from "./chain.js";
import { BookView, CoverForm, TxContext, useTx, StaffContext } from "./Book.jsx";
import Guide from "./Guide.jsx";
import Scanner, { pidFromText } from "./Scanner.jsx";

/* ---------- Transactions: every wallet action reports its real outcome (AT-09) ---------- */
function useTxRunner() {
  const [txs, setTxs] = useState([]);
  const patch = (id, p) => setTxs((l) => l.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const run = useCallback(async (label, send) => {
    const id = `${Date.now()}-${Math.random()}`; // crypto.randomUUID needs HTTPS
    setTxs((l) => [{ id, label, status: "wallet" }, ...l].slice(0, 5));
    try {
      const tx = await send(await writer());
      patch(id, { status: "pending", hash: tx.hash });
      const receipt = await tx.wait();
      patch(id, { status: "confirmed", block: receipt.blockNumber });
      return receipt;
    } catch (e) {
      patch(id, { status: isRejection(e) ? "cancelled" : "failed", message: txError(e) });
      return null;
    }
  }, []);
  return { txs, run, dismiss: (id) => setTxs((l) => l.filter((t) => t.id !== id)) };
}

const TX_STATUS = { wallet: "ລໍຖ້າລົງນາມໃນ MetaMask", pending: "ກຳລັງສົ່ງ", confirmed: "ສຳເລັດ", cancelled: "ຍົກເລີກ", failed: "ບໍ່ສຳເລັດ" };

function TxTray({ txs, dismiss }) {
  if (!txs.length) return null;
  return (
    <aside className="tx-tray" aria-live="polite">
      {txs.map((t) => (
        <div key={t.id} className={`tx tx-${t.status}`}>
          <div className="tx-top"><b>{t.label}</b><button className="x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button></div>
          <div className="tx-status">{TX_STATUS[t.status]}{t.block ? ` · block #${t.block}` : ""}</div>
          {t.hash && <div className="mono small" title={t.hash}>tx {short(t.hash)}</div>}
          {t.message && <div className="small">{t.message}</div>}
        </div>
      ))}
    </aside>
  );
}

/* ---------- Staff directory search: name, title, hospital, province + hospital filter ---------- */
function StaffFinder({ staffList, hospitals, roles, value, onPick }) {
  const [q, setQ] = useState("");
  const [hid, setHid] = useState("");
  const needle = q.trim().toLowerCase();
  const list = staffList.filter((s) =>
    (!roles || roles.includes(s.role)) &&
    (!hid || String(s.hospital_id) === hid) &&
    (!needle || [s.name, s.title, s.hospital, s.province].some((v) => v?.toLowerCase().includes(needle))));
  return (
    <div className="finder">
      <div className="finder-bar">
        <input type="search" aria-label="ຊອກຫາບຸກຄະລາກອນ" placeholder="ຊອກຊື່ທ່ານໝໍ, ພະແນກ ຫຼື ໂຮງໝໍ…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="ກັ່ນຕອງຕາມໂຮງໝໍ" value={hid} onChange={(e) => setHid(e.target.value)}>
          <option value="">ທຸກໂຮງໝໍ</option>
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <ul className="finder-list">
        {list.map((s) => (
          <li key={s.address}>
            <button type="button" aria-pressed={value === s.address} onClick={() => onPick(s)}>
              <b>{s.name}</b>
              <span className="small muted">{ROLE_LABEL[s.role] === "ຄົນເຈັບ" ? "ບໍ່ມີບົດບາດ" : ROLE_LABEL[s.role]}{s.title ? ` · ${s.title}` : ""}</span>
              <span className="hosp">{s.hospital || "ຍັງບໍ່ລະບຸໂຮງໝໍ"}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="empty small">ບໍ່ພົບບຸກຄະລາກອນທີ່ກົງກັບ "{q || hospitals.find((h) => String(h.id) === hid)?.name}".</li>}
      </ul>
    </div>
  );
}

/* ---------- Patient: access control (FR-04) ---------- */
function AccessPanel({ me, staffList, hospitals }) {
  const tx = useTx();
  const [rows, setRows] = useState(null);
  const [grantee, setGrantee] = useState("");
  const [scopes, setScopes] = useState(1);
  const [until, setUntil] = useState(() => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const events = await reader.queryFilter(reader.filters.AccessGranted(me.address));
    const grantees = [...new Set(events.map((e) => e.args.grantee))];
    const state = await Promise.all(grantees.map((g) => reader.grants(me.address, g)));
    setRows(grantees.map((g, i) => ({ address: g, scopes: Number(state[i].scopes), expires: Number(state[i].expires) })));
  }, [me.address]);
  useEffect(() => { load().catch(() => setRows([])); }, [load]);

  const nameOf = (a) => staffList.find((s) => s.address === a);
  const grant = async (e) => {
    e.preventDefault();
    const expires = Math.floor(new Date(`${until}T23:59:59`).getTime() / 1000);
    if (await tx.run("ເປີດສິດໃຫ້ " + (nameOf(grantee)?.name || short(grantee)), (c) => c.grantAccess(grantee, scopes, expires))) load();
  };
  const revoke = async (a) => {
    if (await tx.run("ຖອນສິດ " + (nameOf(a)?.name || short(a)), (c) => c.revokeAccess(a))) load();
  };
  const now = Date.now() / 1000;

  return (
    <div className="panel-grid">
      <form className="card" onSubmit={grant}>
        <h2>ເປີດສິດໃຫ້ແພດ ຫຼື ພະຍາບານ</h2>
        <fieldset>
          <legend>ຜູ້ໄດ້ຮັບສິດ{grantee && <> — <b className="picked">{nameOf(grantee)?.name}</b></>}</legend>
          <StaffFinder staffList={staffList} hospitals={hospitals} roles={["doctor", "nurse"]} value={grantee} onPick={(s) => setGrantee(s.address)} />
        </fieldset>
        <fieldset>
          <legend>ຂໍ້ມູນທີ່ອະນຸຍາດໃຫ້ເບິ່ງ</legend>
          {SCOPES.map((s) => (
            <label key={s.bit} className="check">
              <input type="checkbox" checked={!!(scopes & s.bit)} onChange={() => setScopes(scopes ^ s.bit)} />
              <span><b>{s.label}</b><small>{s.hint}</small></span>
            </label>
          ))}
        </fieldset>
        <label><span>ໝົດອາຍຸວັນທີ</span>
          <input type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} required />
        </label>
        <button className="btn primary" disabled={!grantee || !scopes}>ເປີດສິດ</button>
        <p className="fine">ການຖອນສິດຈະປິດການເຂົ້າເຖິງຜ່ານແອັບທັນທີ, ແຕ່ບໍ່ສາມາດລຶບສຳເນົາທີ່ຜູ້ຮັບເຄີຍດາວໂຫຼດໄປແລ້ວ.</p>
      </form>

      <section className="card">
        <h2>ຜູ້ທີ່ໄດ້ຮັບສິດ</h2>
        {!rows ? <p className="muted">ກຳລັງອ່ານຈາກ Blockchain…</p> : rows.length === 0 ? (
          <p className="empty">ຍັງບໍ່ມີໃຜເຂົ້າເຖິງປຶ້ມຂອງທ່ານ. ເປີດສິດໃຫ້ແພດກ່ອນໄປກວດ.</p>
        ) : (
          <ul className="grants">
            {rows.map((r) => {
              const s = nameOf(r.address);
              const state = !r.scopes ? "revoked" : r.expires < now ? "expired" : "active";
              return (
                <li key={r.address} className={`grant ${state}`}>
                  <div>
                    <b>{s?.name || short(r.address)}</b>
                    <span className="muted small">{s ? ROLE_LABEL[s.role] : ""}{s?.hospital ? ` · ${s.hospital}` : ""} · <span className="mono">{short(r.address)}</span></span>
                    <div className="chips">
                      {SCOPES.filter((x) => r.scopes & x.bit).map((x) => <span key={x.bit} className="chip on">{x.label}</span>)}
                    </div>
                  </div>
                  <div className="grant-side">
                    <span className={`status ${state}`}>{{ active: `ໃຊ້ໄດ້ຮອດ ${laoDate(r.expires * 1000)}`, expired: "ໝົດອາຍຸ", revoked: "ຖອນສິດແລ້ວ" }[state]}</span>
                    {r.scopes > 0 && <button className="btn danger small" onClick={() => revoke(r.address)}>ຖອນສິດ</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- Patient: audit log (FR-06) — API log + on-chain events ---------- */
const ACTION_LABEL = {
  sign_in: "ເຂົ້າສູ່ລະບົບ", create_book: "ສ້າງປຶ້ມ", update_profile: "ແກ້ໄຂຂໍ້ມູນປົກ", view_book: "ເບິ່ງປຶ້ມ",
  access_denied: "ຖືກປະຕິເສດການເຂົ້າເຖິງ", add_record: "ເພີ່ມບັນທຶກ", correct_record: "ແກ້ໄຂບັນທຶກ",
  AccessGranted: "ເປີດສິດ", AccessRevoked: "ຖອນສິດ", RecordAnchored: "ຢືນຢັນ Hash ເທິງ Blockchain", PatientRegistered: "ລົງທະບຽນເທິງ Blockchain",
};

function AuditPanel({ me, staffList }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    (async () => {
      const off = await api(`/patients/${me.pid}/audit`);
      const filters = [reader.filters.AccessGranted(me.address), reader.filters.AccessRevoked(me.address), reader.filters.RecordAnchored(me.address), reader.filters.PatientRegistered(me.address)];
      const events = (await Promise.all(filters.map((f) => reader.queryFilter(f)))).flat();
      const blocks = Object.fromEntries(await Promise.all([...new Set(events.map((e) => e.blockNumber))].map(async (n) => [n, (await reader.runner.getBlock(n)).timestamp])));
      const on = events.map((e) => ({
        at: new Date(blocks[e.blockNumber] * 1000), action: e.eventName, chain: true, tx: e.transactionHash,
        actor: e.eventName === "RecordAnchored" ? e.args.author : me.address,
        target: e.args.grantee,
      }));
      setRows([...off.map((r) => ({ ...r, at: new Date(r.at) })), ...on].sort((a, b) => b.at - a.at));
    })().catch((e) => setErr(e.message));
  }, [me]);
  const name = (a) => (a === me.address ? "ທ່ານ" : staffList.find((s) => s.address === a)?.name || short(a));

  if (err) return <div className="notice deny">{err}</div>;
  if (!rows) return <p className="muted">ກຳລັງໂຫຼດ…</p>;
  return (
    <section className="card">
      <h2>ປະຫວັດການເຂົ້າເຖິງ</h2>
      <p className="fine">ບັນທຶກພຽງເວລາ, ຜູ້ດຳເນີນການ ແລະ ປະເພດກິດຈະກຳ — ບໍ່ມີລາຍລະອຽດທາງການແພດ.</p>
      <table className="audit">
        <thead><tr><th>ເວລາ</th><th>ຜູ້ດຳເນີນການ</th><th>ກິດຈະກຳ</th><th>ແຫຼ່ງ</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.action === "access_denied" ? "denied" : ""}>
              <td>{laoDateTime(r.at)}</td>
              <td>{name(r.actor)}</td>
              <td>{ACTION_LABEL[r.action] || r.action}{r.target ? ` → ${name(r.target)}` : ""}</td>
              <td>{r.chain ? <span className="mono small" title={r.tx}>⛓ {short(r.tx)}</span> : <span className="small muted">API</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---------- Anyone: verify a document against its on-chain hash (AT-07) ---------- */
function VerifyPanel({ staffList }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const check = async (content) => {
    const t = content ?? text;
    const hash = /^0x[0-9a-fA-F]{64}$/.test(t.trim()) ? t.trim() : hashText(t);
    try {
      const a = await reader.anchors(hash);
      setResult({ hash, at: Number(a.anchoredAt), author: a.author });
    } catch { setResult({ hash, error: true }); }
  };
  const onFile = async (file) => { const t = await file.text(); setText(t); check(t); };
  const who = (a) => staffList.find((s) => s.address === a)?.name || short(a);
  return (
    <div className="panel-grid">
      <section className="card">
        <h2>ກວດສອບເອກະສານ</h2>
        <p className="fine">ເລືອກໄຟລ໌ທີ່ດາວໂຫຼດຈາກປຶ້ມ, ວາງເນື້ອຫາ ຫຼື Hash. ລະບົບຄິດໄລ່ Hash ໃນເຄື່ອງຂອງທ່ານ ແລ້ວທຽບກັບ Blockchain.</p>
        <label className="drop">
          <input type="file" accept=".json,application/json,text/plain" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          <span>ເລືອກໄຟລ໌ບັນທຶກ (.json)</span>
        </label>
        <textarea rows={6} className="mono small" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"v":1,"pid":"MC-…"} ຫຼື 0x…' />
        <button className="btn primary" disabled={!text} onClick={() => check()}>ກວດສອບ</button>
      </section>
      <section className="card verify-result" aria-live="polite">
        {!result ? <p className="empty">ຜົນການກວດສອບຈະສະແດງຢູ່ນີ້.</p> : result.error ? (
          <div className="notice deny">ເຊື່ອມຕໍ່ Blockchain ບໍ່ໄດ້. ກວດວ່າ Hardhat node ກຳລັງເຮັດວຽກ.</div>
        ) : result.at ? (
          <>
            <div className="stamp stamp-big"><b>ເອກະສານກົງກັນ</b><span>ບໍ່ຖືກປ່ຽນແປງ</span></div>
            <dl className="kv">
              <dt>ບັນທຶກໂດຍ</dt><dd>{who(result.author)}</dd>
              <dt>ຢືນຢັນເມື່ອ</dt><dd>{laoDateTime(result.at * 1000)}</dd>
              <dt>Hash</dt><dd className="mono small">{result.hash}</dd>
            </dl>
          </>
        ) : (
          <>
            <div className="stamp stamp-big stamp-void"><b>ບໍ່ພົບ Hash ນີ້</b><span>ເອກະສານອາດຖືກແກ້ໄຂ</span></div>
            <p className="fine">Hash <span className="mono">{short(result.hash)}</span> ບໍ່ມີໃນ Blockchain. ການປ່ຽນແປງພຽງຕົວອັກສອນດຽວກໍ່ເຮັດໃຫ້ Hash ຕ່າງກັນ.</p>
          </>
        )}
      </section>
    </div>
  );
}

/* ---------- Admin: staff roles ---------- */
const ROLE_NUM = { none: "0", doctor: "1", nurse: "2", admin: "3" };
const EMPTY_STAFF = { address: "", role: "1", name: "", title: "", hospitalId: "" };

function AdminPanel({ staffList, hospitals, reloadStaff, onError }) {
  const tx = useTx();
  const [f, setF] = useState(EMPTY_STAFF);
  const [h, setH] = useState({ name: "", province: "" });
  const current = staffList.find((s) => s.address.toLowerCase() === f.address.toLowerCase());
  const save = async (e) => {
    e.preventDefault();
    // Role lives on-chain; only send a transaction when it actually changes.
    if (ROLE_NUM[current?.role] !== f.role && !(await tx.run(`ກຳນົດບົດບາດ ${short(f.address)}`, (c) => c.setRole(f.address, Number(f.role))))) return;
    try {
      await api(`/staff/${f.address}`, { method: "PUT", body: { name: f.name, title: f.title, hospitalId: f.hospitalId || null } });
      setF(EMPTY_STAFF);
    } catch (err) { onError(err.message); }
    reloadStaff();
  };
  const addHospital = async (e) => {
    e.preventDefault();
    try { await api("/hospitals", { method: "POST", body: h }); setH({ name: "", province: "" }); reloadStaff(); } catch (err) { onError(err.message); }
  };
  const remove = async (s) => {
    if (await tx.run(`ຖອນບົດບາດ ${s.name}`, (c) => c.setRole(s.address, 0))) reloadStaff();
  };
  return (
    <div className="panel-grid">
      <form className="card" onSubmit={save}>
        <h2>ເພີ່ມ ຫຼື ປ່ຽນບົດບາດບຸກຄະລາກອນ</h2>
        <label><span>Wallet address</span><input className="mono" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value.trim() })} pattern="^0x[0-9a-fA-F]{40}$" required /></label>
        <label><span>ບົດບາດ</span>
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="1">ແພດ</option><option value="2">ພະຍາບານ</option><option value="3">ຜູ້ບໍລິຫານ</option><option value="0">ບໍ່ມີ (ຖອນບົດບາດ)</option>
          </select>
        </label>
        <label><span>ຊື່</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label><span>ຕຳແໜ່ງ / ພະແນກ</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label><span>ໂຮງໝໍ</span>
          <select value={f.hospitalId} onChange={(e) => setF({ ...f, hospitalId: e.target.value })}>
            <option value="">— ບໍ່ລະບຸ —</option>
            {hospitals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <div className="row">
          <button className="btn primary">{current ? "ບັນທຶກການແກ້ໄຂ" : "ເພີ່ມບຸກຄະລາກອນ"}</button>
          {f.address && <button type="button" className="btn" onClick={() => setF(EMPTY_STAFF)}>ລ້າງຟອມ</button>}
        </div>
      </form>
      <section className="card">
        <h2>ບຸກຄະລາກອນ</h2>
        <p className="fine">ກົດທີ່ລາຍຊື່ເພື່ອແກ້ໄຂ.</p>
        <StaffFinder staffList={staffList} hospitals={hospitals} value={f.address}
          onPick={(s) => setF({ address: s.address, role: ROLE_NUM[s.role], name: s.name, title: s.title, hospitalId: s.hospital_id ? String(s.hospital_id) : "" })} />
        {current && (current.role === "doctor" || current.role === "nurse") && (
          <button className="btn danger small" onClick={() => remove(current)}>ຖອນບົດບາດ {current.name}</button>
        )}
      </section>
      <form className="card" onSubmit={addHospital}>
        <h2>ເພີ່ມໂຮງໝໍ</h2>
        <label><span>ຊື່ໂຮງໝໍ</span><input value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} required maxLength={120} /></label>
        <label><span>ແຂວງ</span><input value={h.province} onChange={(e) => setH({ ...h, province: e.target.value })} maxLength={120} /></label>
        <button className="btn primary">ເພີ່ມໂຮງໝໍ</button>
      </form>
      <section className="card">
        <h2>ໂຮງໝໍ ({hospitals.length})</h2>
        <ul className="grants">
          {hospitals.map((x) => (
            <li key={x.id} className="grant">
              <div><b>{x.name}</b><span className="muted small">{x.province}</span></div>
              <span className="status">{staffList.filter((s) => s.hospital_id === x.id).length} ຄົນ</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Staff: find a book by Patient ID ---------- */
function RecentBooks({ filter, onOpen }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api("/recent").then(setRows, () => setRows([])); }, []);
  if (!rows) return <p className="muted">ກຳລັງໂຫຼດປະຫວັດ…</p>;
  const needle = filter.trim().toLowerCase();
  const list = rows.filter((r) => !needle || r.pid.toLowerCase().includes(needle) || r.name?.toLowerCase().includes(needle));
  if (!rows.length) return <p className="empty">ຍັງບໍ່ມີປະຫວັດ. ສະແກນ QR ຫຼື ໃສ່ເລກປຶ້ມ — ປຶ້ມທີ່ທ່ານເປີດຈະຢູ່ທີ່ນີ້.</p>;
  const now = Date.now() / 1000;
  return (
    <section className="card">
      <h2>ປຶ້ມທີ່ເປີດຫຼ້າສຸດ</h2>
      {!list.length ? <p className="empty small">ບໍ່ພົບ “{filter}” ໃນປະຫວັດ — ກົດ ເປີດປຶ້ມ ເພື່ອຊອກດ້ວຍເລກທີ.</p> : (
        <ul className="recent">
          {list.map((r) => {
            const open = r.scopes > 0;
            return (
              <li key={r.pid}>
                <button type="button" className={open ? "" : "no-access"} onClick={() => onOpen(r.pid)}>
                  <span className="recent-name">{r.name || "ບໍ່ມີສິດເຂົ້າເຖິງແລ້ວ"}</span>
                  <span className="mono small">{r.pid}</span>
                  <span className="small muted">ເປີດລ່າສຸດ {laoDateTime(r.lastAt)}{r.writes ? ` · ບັນທຶກ ${r.writes} ຄັ້ງ` : ""}</span>
                  <span className={`status ${open ? "active" : "revoked"}`}>
                    {open ? (r.expires && r.expires - now < 3 * 86400 ? `ສິດໝົດ ${laoDate(r.expires * 1000)}` : "ມີສິດ") : "ຖອນ/ໝົດສິດ"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StaffSearch({ me, onError, initialPid }) {
  const [q, setQ] = useState(initialPid || "");
  const [pid, setPid] = useState(initialPid || null);
  const [scanning, setScanning] = useState(false);
  const open = useCallback((p) => { setScanning(false); setQ(p); setPid(p); window.scrollTo({ top: 0 }); }, []);
  const closeScanner = useCallback(() => setScanning(false), []);
  return (
    <>
      <form className="search" onSubmit={(e) => { e.preventDefault(); open(pidFromText(q) || q.trim().toUpperCase()); }}>
        <label htmlFor="pid">ເປີດປຶ້ມດ້ວຍເລກທີ</label>
        <input id="pid" className="mono" value={q} onChange={(e) => { setQ(e.target.value); if (pid) setPid(null); }}
          placeholder="MC-2026-123456 ຫຼື ຊື່" required autoComplete="off" />
        <button className="btn primary">ເປີດປຶ້ມ</button>
        <button type="button" className="btn scan-btn" onClick={() => setScanning(true)}>📷 ສະແກນ QR</button>
      </form>
      {scanning && <Scanner onScan={open} onClose={closeScanner} />}
      {pid ? (
        <>
          <button className="link back" onClick={() => { setPid(null); setQ(""); }}>← ປຶ້ມທີ່ເປີດຫຼ້າສຸດ</button>
          <BookView key={pid} pid={pid} me={me} onError={onError} />
        </>
      ) : <RecentBooks filter={q} onOpen={open} />}
    </>
  );
}

/* ---------- Patient home ---------- */
function PatientHome({ me, refresh, onError }) {
  const tx = useTx();
  const [busy, setBusy] = useState(false);
  const create = async (profile) => {
    setBusy(true);
    try {
      await assertNetwork();
      const { pid } = await api("/patients", { method: "POST", body: profile });
      await tx.run("ລົງທະບຽນປຶ້ມ " + pid, (c) => c.registerPatient(idHash(pid)));
      await refresh();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  };
  const register = async () => {
    if (await tx.run("ລົງທະບຽນປຶ້ມ " + me.pid, (c) => c.registerPatient(idHash(me.pid)))) refresh();
  };
  if (!me.pid) return <div className="solo"><CoverForm onSubmit={create} busy={busy} /></div>;
  if (!me.registered) {
    return (
      <div className="notice">
        <b>ປຶ້ມ {me.pid} ຍັງບໍ່ໄດ້ລົງທະບຽນເທິງ Blockchain</b>
        <p>ກ່ອນແພດຈະເຂົ້າເຖິງໄດ້ ທ່ານຕ້ອງລົງນາມລົງທະບຽນເລກປຶ້ມນີ້ໃຫ້ກັບ Wallet ຂອງທ່ານ.</p>
        <button className="btn primary" onClick={register}>ລົງທະບຽນເທິງ Blockchain</button>
      </div>
    );
  }
  return <BookView pid={me.pid} me={me} onError={onError} />;
}

/* ---------- Shell ---------- */
const TABS = {
  none: [["book", "ປຶ້ມຂອງຂ້ອຍ"], ["access", "ສິດການເຂົ້າເຖິງ"], ["audit", "ປະຫວັດການເຂົ້າເຖິງ"], ["verify", "ກວດສອບເອກະສານ"], ["guide", "ຄູ່ມື"]],
  doctor: [["search", "ປຶ້ມຄົນເຈັບ"], ["verify", "ກວດສອບເອກະສານ"], ["guide", "ຄູ່ມື"]],
  nurse: [["search", "ປຶ້ມຄົນເຈັບ"], ["verify", "ກວດສອບເອກະສານ"], ["guide", "ຄູ່ມື"]],
  admin: [["staff", "ບຸກຄະລາກອນ"], ["verify", "ກວດສອບເອກະສານ"], ["guide", "ຄູ່ມື"]],
};

export default function App() {
  const txr = useTxRunner();
  const [account, setAccount] = useState(null);
  const [netStatus, setNetStatus] = useState(null);
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // Set when a doctor arrives from a patient's QR code (?pid=MC-…).
  const [pidParam] = useState(() => new URLSearchParams(location.search).get("pid")?.trim().toUpperCase() || null);
  const [staffList, setStaffList] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const loadDirectory = useCallback(() => Promise.all([api("/staff").then(setStaffList), api("/hospitals").then(setHospitals)]).catch(() => {}), []);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ db: false, chain: false, api: false }));
  }, []);

  const applyMe = useCallback((m) => {
    setMe(m);
    setTab((t) => (TABS[m.role].some(([k]) => k === t) ? t : TABS[m.role][0][0]));
    loadDirectory();
    return m;
  }, [loadDirectory]);
  const loadMe = useCallback(async (address) => applyMe(await signIn(address)), [applyMe]);

  // Page reload: pick the session back up silently if MetaMask still has this site connected.
  useEffect(() => {
    restoreSession().then(async (s) => {
      if (!s) return;
      setAccount(s.address);
      setNetStatus(await walletChainStatus().catch(() => null));
      applyMe(s.me);
    }).catch(() => {});
  }, [applyMe]);

  const connect = async () => {
    setError(null);
    if (!hasWallet()) return setError("ບໍ່ພົບ MetaMask. ຕິດຕັ້ງ MetaMask extension ແລ້ວໂຫຼດໜ້ານີ້ຄືນ.");
    setConnecting(true);
    try {
      const a = await requestAccount();
      setAccount(a);
      setNetStatus(await walletChainStatus().catch(() => null));
      await loadMe(a);
    } catch (e) {
      setError(isRejection(e) ? "ທ່ານປະຕິເສດການເຊື່ອມຕໍ່ ຫຼື ການລົງນາມເຂົ້າສູ່ລະບົບ. ກົດເຊື່ອມຕໍ່ອີກຄັ້ງເມື່ອພ້ອມ." : e.message);
    } finally { setConnecting(false); }
  };

  const disconnect = () => { signOut(account); setAccount(null); setMe(null); };

  useEffect(() => {
    if (!hasWallet()) return;
    const onAccounts = ([a]) => { setMe(null); setAccount(null); if (a) setError("ບັນຊີໃນ MetaMask ປ່ຽນແລ້ວ. ກົດເຊື່ອມຕໍ່ເພື່ອເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີໃໝ່."); };
    const onChain = () => walletChainStatus().then(setNetStatus, () => setNetStatus(null));
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => { window.ethereum.removeListener("accountsChanged", onAccounts); window.ethereum.removeListener("chainChanged", onChain); };
  }, []);

  const staffMap = useMemo(() => Object.fromEntries(staffList.map((s) => [s.address, s])), [staffList]);
  const wrongNet = account && netStatus && netStatus !== "ok";
  const down = health && !(health.db && health.chain);

  return (
    <TxContext.Provider value={txr}>
      <StaffContext.Provider value={staffMap}>
        <header className="top">
          <div className="brand"><img className="mark" src="/moh-logo.jpg" alt="ກະຊວງສາທາລະນະສຸກ" /> MediChain <small>ປຶ້ມຕິດຕາມກວດພະຍາດ</small></div>
          {account && (
            <div className="wallet">
              <span className={`net ${wrongNet ? "bad" : "ok"}`}>{wrongNet ? "Network ຜິດ" : `MediChain · ${CHAIN_ID}`}</span>
              <span className="addr mono" title={account}>{short(account)}</span>
              {me && <span className="role">{me.staff?.name || ROLE_LABEL[me.role]}{me.staff?.hospital ? ` · ${me.staff.hospital}` : ""}</span>}
              <button className="btn small" onClick={disconnect}>ຕັດການເຊື່ອມຕໍ່</button>
            </div>
          )}
        </header>

        {down && (
          <div className="banner" role="alert">
            {health.api === false ? "Backend API ບໍ່ພ້ອມໃຊ້ (npm run server)." : !health.chain ? "Hardhat node ບໍ່ພ້ອມໃຊ້ (npm run chain)." : "ຖານຂໍ້ມູນ PostgreSQL ບໍ່ພ້ອມໃຊ້ (npm run db)."}
          </div>
        )}
        {wrongNet && (
          <div className="banner" role="alert">
            {networkMessage(netStatus)} ທຸລະກຳຈະບໍ່ຖືກສົ່ງຈົນກວ່າຈະແກ້.
            <button className="btn small" onClick={() => switchToHardhat().then(() => walletChainStatus().then(setNetStatus)).catch((e) => setError(e.message))}>
              {netStatus === "wrongRpc" ? "ແກ້ RPC" : "ສະຫຼັບ Network"}
            </button>
          </div>
        )}
        {error && <div className="banner soft" role="alert">{error}<button className="x" aria-label="Dismiss" onClick={() => setError(null)}>×</button></div>}

        <main>
          {!me && guideOpen ? (
            <>
              <button className="link back" onClick={() => setGuideOpen(false)}>← ກັບໜ້າເຂົ້າສູ່ລະບົບ</button>
              <Guide />
            </>
          ) : !me ? (
            <section className="landing">
              <div className="cover cover-landing">
                <div className="cover-head">
                  <p className="state">ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ</p>
                  <p className="motto">ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ</p>
                </div>
                <h1 className="cover-title">ປຶ້ມຕິດຕາມ<br />ກວດພະຍາດ</h1>
                <p className="lede">ປຶ້ມປະຫວັດການຮັກສາທີ່ທ່ານເປັນເຈົ້າຂອງ. ທ່ານເລືອກວ່າແພດຄົນໃດເບິ່ງໄດ້, ແລະ ທຸກບັນທຶກມີຕາປະທັບເທິງ Blockchain ທີ່ບໍ່ມີໃຜແກ້ໄຂໄດ້.</p>
                <button className="btn primary big" onClick={connect} disabled={connecting}>{connecting ? "ກຳລັງເຊື່ອມຕໍ່…" : "ເຊື່ອມຕໍ່ MetaMask"}</button>
                {pidParam && <p className="notice qr-notice">ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີແພດ ຫຼື ພະຍາບານ ເພື່ອເປີດປຶ້ມ <b className="mono">{pidParam}</b></p>}
                <p><button className="link guide-link" onClick={() => setGuideOpen(true)}>ຄັ້ງທຳອິດ? ອ່ານຄູ່ມືການເຊື່ອມຕໍ່ ແລະ Flow ການໃຊ້ງານ</button></p>
                <p className="fine">ສະພາບແວດລ້ອມທົດລອງ · ໃຊ້ຂໍ້ມູນຈຳລອງເທົ່ານັ້ນ · Contract <span className="mono">{short(contractAddress)}</span></p>
              </div>
            </section>
          ) : (
            <>
              <nav className="tabs" role="tablist">
                {TABS[me.role].map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
                ))}
              </nav>
              {tab === "book" && <PatientHome me={me} refresh={() => loadMe(account)} onError={setError} />}
              {tab === "access" && (me.registered ? <AccessPanel me={me} staffList={staffList} hospitals={hospitals} /> : <p className="empty">ສ້າງ ແລະ ລົງທະບຽນປຶ້ມກ່ອນ ຈຶ່ງເປີດສິດໃຫ້ແພດໄດ້.</p>)}
              {tab === "audit" && (me.pid ? <AuditPanel me={me} staffList={staffList} /> : <p className="empty">ຍັງບໍ່ມີປຶ້ມ.</p>)}
              {tab === "guide" && <Guide />}
              {tab === "verify" && <VerifyPanel staffList={staffList} />}
              {tab === "search" && <StaffSearch me={me} onError={setError} initialPid={pidParam} />}
              {tab === "staff" && <AdminPanel staffList={staffList} hospitals={hospitals} reloadStaff={loadDirectory} onError={setError} />}
            </>
          )}
        </main>
        <TxTray txs={txr.txs} dismiss={txr.dismiss} />
      </StaffContext.Provider>
    </TxContext.Provider>
  );
}
