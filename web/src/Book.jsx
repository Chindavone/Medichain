import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, assertNetwork, reader, laoDate, laoDateTime, short, KIND_SCOPE, SCOPES } from "./chain.js";

export const TxContext = createContext(null);
export const useTx = () => useContext(TxContext);
export const StaffContext = createContext({});

/* ---------- Cover: the front of the paper book ---------- */
const COVER_FIELDS = [
  ["name", "ຊື່ ແລະ ນາມສະກຸນ"],
  ["position", "ໜ້າທີ່ຮັບຜິດຊອບ"],
  ["ministry", "ກະຊວງ (ເມືອງ)"],
  ["department", "ກົມ (ຕາແສງ)"],
  ["division", "ພະແນກ (ບ້ານ)"],
];
const EXTRA_FIELDS = [
  ["dob", "ວັນເດືອນປີເກີດ", "date"],
  ["sex", "ເພດ", "sex"],
  ["phone", "ເບີໂທ", "tel"],
  ["insuranceNo", "ເລກ ກ.ປ.ຊ", "text"],
  ["allergies", "ແພ້ຢາ / ແພ້ອາຫານ", "text"],
];
const age = (dob) => (dob ? Math.floor((Date.now() - new Date(dob)) / 3.15576e10) : "");

function CoverHead() {
  return (
    <div className="cover-head">
      <p className="state">ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ</p>
      <p className="motto">ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ</p>
      <p className="ministry">ກະຊວງສາທາລະນະສຸກ<br />ໂຮງໝໍມະໂຫສົດ</p>
    </div>
  );
}

export function Cover({ pid, profile, wallet }) {
  return (
    <section className="cover" aria-label="Patient book cover">
      <CoverHead />
      {profile.insuranceNo && (
        <div className="stamp stamp-cover" aria-label="Social security beneficiary">
          <b>ຜູ້ເກີດສິດ ກ.ປ.ຊ</b>
          <span>{profile.insuranceNo}</span>
        </div>
      )}
      <h1 className="cover-title">ປຶ້ມຕິດຕາມ<br />ກວດພະຍາດ</h1>
      <p className="cover-no">ເລກທີ <span className="mono">{pid}</span></p>
      <dl className="cover-fields">
        <div><dt>ຊື່ ແລະ ນາມສະກຸນ</dt><dd>{profile.name} <span className="age">ອາຍຸ {age(profile.dob)}</span></dd></div>
        {COVER_FIELDS.slice(1).map(([k, label]) => (
          <div key={k}><dt>{label}</dt><dd>{profile[k] || "—"}</dd></div>
        ))}
      </dl>
      <dl className="cover-extra">
        {EXTRA_FIELDS.map(([k, label]) => (
          <div key={k}><dt>{label}</dt><dd>{k === "sex" ? { m: "ຊາຍ", f: "ຍິງ" }[profile.sex] || "—" : profile[k] || "—"}</dd></div>
        ))}
        <div><dt>Wallet</dt><dd className="mono" title={wallet}>{short(wallet)}</dd></div>
      </dl>
    </section>
  );
}

export function CoverForm({ initial = {}, onSubmit, busy }) {
  const [f, setF] = useState({ sex: "", ...initial });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="cover cover-form" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <CoverHead />
      <h1 className="cover-title">ປຶ້ມຕິດຕາມ<br />ກວດພະຍາດ</h1>
      <p className="cover-no">ເລກທີ <span className="muted">ລະບົບຈະອອກເລກໃຫ້</span></p>
      <div className="cover-fields">
        {COVER_FIELDS.map(([k, label]) => (
          <label key={k}><span>{label}</span>
            <input value={f[k] || ""} onChange={set(k)} required={k === "name"} maxLength={200} />
          </label>
        ))}
      </div>
      <div className="cover-extra">
        {EXTRA_FIELDS.map(([k, label, type]) => (
          <label key={k}><span>{label}</span>
            {type === "sex" ? (
              <select value={f.sex} onChange={set("sex")}>
                <option value="">—</option><option value="m">ຊາຍ</option><option value="f">ຍິງ</option>
              </select>
            ) : (
              <input type={type} value={f[k] || ""} onChange={set(k)} required={k === "dob"} maxLength={200} />
            )}
          </label>
        ))}
      </div>
      <p className="fine">ຂໍ້ມູນເຫຼົ່ານີ້ຖືກເຂົ້າລະຫັດ ແລະເກັບໄວ້ນອກ Blockchain. ເທິງ Blockchain ມີພຽງ Hash ຂອງເລກປຶ້ມ ແລະ Wallet ຂອງທ່ານ.</p>
      <button className="btn primary" disabled={busy}>{busy ? "ກຳລັງບັນທຶກ…" : "ສ້າງປຶ້ມ ແລະ ລົງທະບຽນ"}</button>
    </form>
  );
}

/* ---------- Pages: two ruled columns, exactly like the printed book ---------- */
function Vitals({ d }) {
  const parts = [d.bp && `TA ${d.bp}`, d.pulse && `P ${d.pulse}`, d.temp && `T ${d.temp}°`, d.weight && `W ${d.weight} kg`].filter(Boolean);
  return <div className="hand">{parts.map((p) => <div key={p}>{p}</div>)}{d.note && <div className="note">{d.note}</div>}</div>;
}

function Consult({ d }) {
  return (
    <div className="hand">
      {d.symptoms && <p><i>CC:</i> {d.symptoms}</p>}
      {d.exam && <p><i>PE:</i> {d.exam}</p>}
      {d.diagnosis && <p className="dx"><i>Dx:</i> {d.diagnosis}</p>}
      {d.medications && <ul className="meds">{d.medications.split("\n").filter(Boolean).map((m, i) => <li key={i}>{m}</li>)}</ul>}
      {d.plan && <p><i>Plan:</i> {d.plan}</p>}
      {d.followUp && <p className="follow">ນັດກວດຄືນ {laoDate(d.followUp)}</p>}
    </div>
  );
}

function Lab({ d }) {
  return (
    <div className="hand lab">
      {d.panel && <p className="dx">{d.panel}</p>}
      {d.results?.split("\n").filter(Boolean).map((l, i) => {
        const [k, ...v] = l.split(":");
        return <div key={i} className="lab-row"><span>{k}</span><span>{v.join(":")}</span></div>;
      })}
    </div>
  );
}

const Body = ({ r }) => {
  const d = JSON.parse(r.canonical).data;
  return r.kind === "vitals" ? <Vitals d={d} /> : r.kind === "lab" ? <Lab d={d} /> : <Consult d={d} />;
};

function Stamp({ record, anchor, canAnchor, onAnchor }) {
  if (anchor?.at) {
    return (
      <div className="stamp" title={`Record hash ${record.hash}`}>
        <b>ຢືນຢັນເທິງ Blockchain</b>
        <span>{laoDateTime(anchor.at * 1000)}</span>
        <span className="mono">{short(record.hash)}</span>
      </div>
    );
  }
  return (
    <div className="stamp stamp-pending">
      <b>ຍັງບໍ່ຢືນຢັນ</b>
      {canAnchor ? <button className="link" onClick={onAnchor}>ລົງນາມຢືນຢັນ</button> : <span>ລໍຖ້າຜູ້ບັນທຶກລົງນາມ</span>}
    </div>
  );
}

function Entry({ r, anchors, history, me, patientWallet, onCorrect, onAnchored }) {
  const staff = useContext(StaffContext);
  const tx = useTx();
  const author = staff[r.author];
  const anchor = async (rec) => {
    const ok = await tx.run("ຢືນຢັນບັນທຶກເທິງ Blockchain", (c) => c.anchorRecord(patientWallet, rec.hash, KIND_SCOPE[rec.kind]));
    if (ok) onAnchored();
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([r.canonical], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `${JSON.parse(r.canonical).pid}-${r.id}.json` }).click();
    URL.revokeObjectURL(url);
  };
  return (
    <article className={`entry kind-${r.kind}`}>
      <header>
        <span className="kind">{{ consult: "ການກວດ", vitals: "ສັນຍານຊີບ", lab: "ຜົນກວດ" }[r.kind]}</span>
        <span className="who">{author?.name || short(r.author)}{author?.hospital ? ` · ${author.hospital}` : ""} · {laoDateTime(r.createdAt)}</span>
      </header>
      <Body r={r} />
      <footer>
        <Stamp record={r} anchor={anchors[r.hash]} canAnchor={r.author === me.address} onAnchor={() => anchor(r)} />
        <div className="entry-actions">
          <button className="link" onClick={download}>ດາວໂຫຼດເອກະສານ</button>
          {onCorrect && <button className="link" onClick={() => onCorrect(r)}>ແກ້ໄຂ</button>}
        </div>
      </footer>
      {history.length > 0 && (
        <details className="history">
          <summary>ສະບັບກ່ອນແກ້ໄຂ ({history.length})</summary>
          {history.map((h) => (
            <div key={h.id} className="old">
              <span className="who">{staff[h.author]?.name || short(h.author)} · {laoDateTime(h.createdAt)} · <span className="mono">{short(h.hash)}</span></span>
              <Body r={h} />
            </div>
          ))}
        </details>
      )}
    </article>
  );
}

export function Pages({ records, anchors, me, patientWallet, correctable = [], onCorrect, onAnchored }) {
  const byId = Object.fromEntries(records.map((r) => [r.id, r]));
  const superseded = new Set(records.map((r) => r.supersedes).filter(Boolean));
  const current = records.filter((r) => !superseded.has(r.id));
  const historyOf = (r) => { const out = []; for (let p = byId[r.supersedes]; p; p = byId[p.supersedes]) out.push(p); return out; };

  const days = [];
  for (const r of current) {
    const day = laoDate(r.createdAt);
    if (days.at(-1)?.day !== day) days.push({ day, left: [], right: [] });
    days.at(-1)[r.kind === "vitals" ? "left" : "right"].push(r);
  }
  if (!days.length) return <p className="empty">ຍັງບໍ່ມີບັນທຶກການກວດ. ໜ້າປຶ້ມຈະປາກົດເມື່ອແພດ ຫຼື ພະຍາບານບັນທຶກ.</p>;

  const entry = (r) => (
    <Entry key={r.id} r={r} anchors={anchors} history={historyOf(r)} me={me} patientWallet={patientWallet}
      onCorrect={correctable.includes(r.kind) ? onCorrect : null} onAnchored={onAnchored} />
  );
  return (
    <section className="pages" aria-label="Treatment timeline">
      <div className="page-row page-head" aria-hidden="true">
        <div>ວັນທີ<br />ຊື່ ແລະ ລາຍເຊັນຜູ້ສົ່ງ<br />ປະທັບຕາພ້ອມ</div>
        <div>ອາການພະຍາດ, ການວາງຢາປິ່ນປົວ. ຊື່ ແລະ<br />ລາຍເຊັນແພດກວດພະຍາດ</div>
      </div>
      {days.slice().reverse().map((d) => (
        <div className="page-row" key={d.day}>
          <div className="left"><time className="day hand">{d.day}</time>{d.left.map(entry)}</div>
          <div className="right">{d.right.map(entry)}</div>
        </div>
      ))}
    </section>
  );
}

/* ---------- Entry form for doctors and nurses ---------- */
const FORMS = {
  vitals: [["bp", "TA (ຄວາມດັນ)", "120/80"], ["pulse", "P (ຊີບພະຈອນ)", "71"], ["temp", "T (°C)", "36.5"], ["weight", "W (kg)", "60"], ["note", "ໝາຍເຫດ", "", "area"]],
  consult: [["symptoms", "ອາການ (CC)", "", "area"], ["exam", "ກວດຮ່າງກາຍ (PE)", "", "area"], ["diagnosis", "ວິນິດໄສ (Dx)", ""],
    ["medications", "ຢາ — ແຖວລະ 1 ລາຍການ", "Loratadine 10mg 1×1", "area"], ["plan", "ແຜນການຮັກສາ", "", "area"], ["followUp", "ນັດກວດຄືນ", "", "date"]],
  lab: [["panel", "ປະເພດການກວດ", "CBC"], ["results", "ຜົນ — ແຖວລະ 1 ລາຍການ", "HGB: 14.3\nPLT: 274", "area"]],
};

export function EntryForm({ kinds, draft, onSubmit, onCancel, busy }) {
  const [kind, setKind] = useState(draft?.kind || kinds[0]);
  const [data, setData] = useState(draft?.data || {});
  useEffect(() => { setKind(draft?.kind || kinds[0]); setData(draft?.data || {}); }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form className="entry-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ kind, data, supersedes: draft?.supersedes }); }}>
      <div className="seg" role="tablist">
        {kinds.map((k) => (
          <button type="button" role="tab" aria-selected={k === kind} key={k} disabled={!!draft?.supersedes}
            onClick={() => { setKind(k); setData({}); }}>{{ consult: "ການກວດ", vitals: "ສັນຍານຊີບ", lab: "ຜົນກວດ" }[k]}</button>
        ))}
      </div>
      {draft?.supersedes && <p className="fine">ກຳລັງແກ້ໄຂບັນທຶກ #{draft.supersedes}. ສະບັບເກົ່າຈະຍັງເກັບໄວ້ໃນປະຫວັດ.</p>}
      <div className={`fields fields-${kind}`}>
        {FORMS[kind].map(([k, label, ph, type]) => (
          <label key={k} className={type === "area" ? "wide" : ""}><span>{label}</span>
            {type === "area"
              ? <textarea rows={k === "medications" || k === "results" ? 4 : 2} placeholder={ph} value={data[k] || ""} maxLength={2000} onChange={(e) => setData({ ...data, [k]: e.target.value })} />
              : <input type={type || "text"} placeholder={ph} value={data[k] || ""} maxLength={200} onChange={(e) => setData({ ...data, [k]: e.target.value })} />}
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn primary" disabled={busy || !Object.values(data).some(Boolean)}>{busy ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ ແລະ ລົງນາມ"}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>ຍົກເລີກ</button>}
      </div>
      <p className="fine">ບັນທຶກຈະເຂົ້າລະຫັດເກັບໃນຖານຂໍ້ມູນ, ຈາກນັ້ນ MetaMask ຈະຂໍໃຫ້ລົງນາມ Hash ຂອງບັນທຶກລົງ Blockchain.</p>
    </form>
  );
}

/* ---------- Whole book, loaded and access-checked by the API ---------- */
export function BookView({ pid, me, onError }) {
  const tx = useTx();
  const [book, setBook] = useState(null);
  const [anchors, setAnchors] = useState({});
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const b = await api(`/patients/${encodeURIComponent(pid)}`);
      setBook(b); setError(null);
      const list = await Promise.all(b.records.map((r) => reader.anchors(r.hash).then((a) => [r.hash, { author: a.author, at: Number(a.anchoredAt) }]).catch(() => [r.hash, null])));
      setAnchors(Object.fromEntries(list));
    } catch (e) { setBook(null); setError(e.message); }
  }, [pid]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="notice deny" role="alert"><b>ບໍ່ສາມາດເປີດປຶ້ມ {pid}</b><p>{error}</p></div>;
  if (!book) return <p className="muted">ກຳລັງເປີດປຶ້ມ…</p>;

  const isStaff = me.role === "doctor" || me.role === "nurse";
  const kinds = !isStaff ? [] : Object.keys(KIND_SCOPE).filter((k) => book.scopes & KIND_SCOPE[k] && (me.role === "doctor" || k === "vitals"));

  const save = async (rec) => {
    setBusy(true);
    try {
      await assertNetwork();
      const saved = await api(`/patients/${encodeURIComponent(pid)}/records`, { method: "POST", body: rec });
      setDraft(null);
      setFormKey((k) => k + 1);
      await load();
      await tx.run("ຢືນຢັນບັນທຶກເທິງ Blockchain", (c) => c.anchorRecord(saved.patientWallet, saved.hash, saved.scope));
      await load();
    } catch (e) { onError?.(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="book">
      <Cover pid={book.pid} profile={book.profile} wallet={book.wallet} />
      <div className="book-inner">
        {isStaff && (
          <div className="access-strip">
            <span>ສິດຂອງທ່ານໃນປຶ້ມນີ້:</span>
            {SCOPES.map((s) => <span key={s.bit} className={`chip ${book.scopes & s.bit ? "on" : "off"}`}>{s.label}</span>)}
          </div>
        )}
        {kinds.length > 0 && <EntryForm key={formKey} kinds={kinds} draft={draft} onSubmit={save} onCancel={draft && (() => setDraft(null))} busy={busy} />}
        <Pages records={book.records} anchors={anchors} me={me} patientWallet={book.wallet} onAnchored={load}
          correctable={kinds} onCorrect={(r) => { setDraft({ kind: r.kind, data: JSON.parse(r.canonical).data, supersedes: r.id }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      </div>
    </div>
  );
}
