import { useState } from "react";
import { CHAIN_ID, RPC_URL, hasWallet, switchToHardhat } from "./chain.js";
import ContractGuide from "./ContractGuide.jsx";

// The end-to-end flow. `chain` names the contract call when the step writes to the blockchain.
const FLOW = [
  { who: "patient", title: "ເຊື່ອມ MetaMask ແລະ Sign in", body: "ລົງນາມຂໍ້ຄວາມເພື່ອຢືນຢັນວ່າເປັນເຈົ້າຂອງ wallet — ບໍ່ເສຍຄ່າທຳນຽມ." },
  { who: "patient", title: "ສ້າງປຶ້ມ", body: "ຕື່ມໜ້າປົກ → ໄດ້ເລກປຶ້ມ MC-ປີ-xxxxxx. ຂໍ້ມູນເຂົ້າລະຫັດເກັບໃນຖານຂໍ້ມູນ.", chain: "registerPatient" },
  { who: "patient", title: "ເປີດສິດໃຫ້ທ່ານໝໍ", body: "ຊອກຊື່ ຫຼື ໂຮງໝໍ → ເລືອກປະເພດຂໍ້ມູນ ແລະ ວັນໝົດອາຍຸ.", chain: "grantAccess" },
  { who: "staff", title: "ທ່ານໝໍເປີດປຶ້ມດ້ວຍເລກທີ", body: "Server ກວດສິດເທິງ Blockchain ທຸກຄັ້ງ — ສົ່ງສະເພາະຂໍ້ມູນທີ່ໄດ້ຮັບອະນຸຍາດ." },
  { who: "staff", title: "ບັນທຶກການກວດ ແລະ ລົງນາມ", body: "ບັນທຶກຖືກເຂົ້າລະຫັດ, hash ຂຶ້ນ Blockchain → ໄດ້ຕາປະທັບແດງ.", chain: "anchorRecord" },
  { who: "patient", title: "ຖອນສິດ", body: "ທ່ານໝໍຈະເປີດປຶ້ມບໍ່ໄດ້ອີກທັນທີ.", chain: "revokeAccess" },
  { who: "anyone", title: "ກວດສອບເອກະສານ", body: "ດາວໂຫຼດບັນທຶກ → ທຽບ hash ກັບ Blockchain → ກົງກັນ ຫຼື ຖືກແກ້ໄຂ." },
];
const WHO = { patient: "ຄົນເຈັບ", staff: "ແພດ / ພະຍາບານ", anyone: "ທຸກຄົນ" };

const ACCOUNTS = [
  ["0", "Admin", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"],
  ["1", "ແພດ — ສົມພອນ", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"],
  ["2", "ແພດ — ວິໄລພອນ", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"],
  ["3", "ພະຍາບານ — ດາວວອນ", "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"],
  ["4", "ຄົນເຈັບ", "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"],
  ["5", "ຄົນເຈັບ", "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"],
];

const ROLES = [
  ["ຄົນເຈັບ", [
    "ປຶ້ມຂອງຂ້ອຍ — ສ້າງປຶ້ມຄັ້ງທຳອິດ (ຊື່ ແລະ ວັນເກີດ ຕ້ອງໃສ່), ເບິ່ງປະຫວັດການກວດທັງໝົດ.",
    "QR ເທິງໜ້າປົກ — ກົດ “ສະແດງ QR ໃຫຍ່” ໃຫ້ທ່ານໝໍສະແກນ. QR ບໍ່ໄດ້ໃຫ້ສິດ, ຕ້ອງເປີດສິດກ່ອນ.",
    "ສິດການເຂົ້າເຖິງ — ເປີດສິດໃຫ້ທ່ານໝໍ/ພະຍາບານ ຕາມປະເພດຂໍ້ມູນ ແລະ ວັນໝົດອາຍຸ, ຖອນສິດໄດ້ທຸກເວລາ.",
    "ປະຫວັດການເຂົ້າເຖິງ — ໃຜເບິ່ງ, ເພີ່ມ, ຖືກປະຕິເສດ ເມື່ອໃດ. ⛓ = ບັນທຶກເທິງ Blockchain.",
  ]],
  ["ແພດ ແລະ ພະຍາບານ", [
    "ປຶ້ມຄົນເຈັບ — ກົດ 📷 ສະແກນ QR ເພື່ອເປີດກ້ອງໃນເວັບ, ຫຼື ສະແກນດ້ວຍກ້ອງມືຖື (ເປີດໃນແອັບ MetaMask), ຫຼື ໃສ່ເລກປຶ້ມເອງ. ແຖບສີຟ້າບອກວ່າທ່ານມີສິດປະເພດໃດ.",
    "ປຶ້ມທີ່ເປີດຫຼ້າສຸດ — ລາຍການປຶ້ມທີ່ທ່ານເຄີຍເປີດ, ກົດເພື່ອເປີດຄືນ, ພິມຊື່ ຫຼື ເລກເພື່ອກັ່ນຕອງ. ປຶ້ມທີ່ຖືກຖອນສິດຈະບໍ່ສະແດງຊື່.",
    "ແພດບັນທຶກ ການກວດ, ສັນຍານຊີບ, ຜົນກວດ. ພະຍາບານບັນທຶກສັນຍານຊີບເທົ່ານັ້ນ.",
    "ຖ້າກົດ Reject ໃນ MetaMask ບັນທຶກຂຶ້ນ “ຍັງບໍ່ຢືນຢັນ” → ກົດ “ລົງນາມຢືນຢັນ” ເພື່ອລອງໃໝ່.",
    "ແກ້ໄຂ — ສະບັບເກົ່າຍັງເກັບໄວ້ໃນ “ສະບັບກ່ອນແກ້ໄຂ”, ບໍ່ມີການລຶບ.",
  ]],
  ["Admin", [
    "ເພີ່ມໂຮງໝໍ (ຊື່ ແລະ ແຂວງ).",
    "ເພີ່ມບຸກຄະລາກອນ: wallet, ບົດບາດ, ຊື່, ຕຳແໜ່ງ, ໂຮງໝໍ. ປ່ຽນບົດບາດຕ້ອງ Confirm ໃນ MetaMask.",
    "ຖອນບົດບາດ — ຜູ້ນັ້ນເສຍສິດເຂົ້າເຖິງທຸກປຶ້ມທັນທີ.",
  ]],
];

const TROUBLE = [
  ["ບໍ່ພົບ MetaMask", "ຕິດຕັ້ງ extension ແລ້ວໂຫຼດໜ້າຄືນ. ໃນມືຖືໃຫ້ເປີດເວັບຜ່ານ browser ໃນແອັບ MetaMask."],
  ["ແຖບແດງ “Network ຜິດ”", "ກົດ “ສະຫຼັບ Network”. ລະບົບບໍ່ສົ່ງທຸລະກຳໃນ Network ອື່ນ."],
  ["“Network fee” ສີແດງ, ກົດ Confirm ບໍ່ໄດ້", "Wallet ບໍ່ມີ ETH ທົດລອງ — ກົດ “ຂໍ 0.1 ETH” ໃນໜ້າທຳອິດ ຫຼື ແຖບເທິງຫຼັງເຂົ້າສູ່ລະບົບ, ຫຼື ໃຊ້ບັນຊີ #0–#5."],
  ["“RPC ຊີ້ໄປ Blockchain ອື່ນ” ຫຼື “already registered”", "Network ໃນ MetaMask ມີ Chain ID ຖືກ ແຕ່ RPC ເປັນ 127.0.0.1:8545 (ເຄື່ອງຕົນເອງ). ກົດ “ແກ້ RPC” ຫຼື MetaMask → Networks → ແກ້ RPC URL ເປັນຄ່າໃນຂໍ້ 1 ຂ້າງເທິງ."],
  ["ທຸລະກຳຄ້າງ ຫຼັງ reset chain", "MetaMask → Settings → Advanced → Clear activity tab data."],
  ["“ທ່ານບໍ່ມີສິດເຂົ້າເຖິງປຶ້ມນີ້”", "ຄົນເຈັບຍັງບໍ່ເປີດສິດ, ສິດໝົດອາຍຸ ຫຼື ຖືກຖອນແລ້ວ."],
  ["“ໝົດເວລາເຂົ້າສູ່ລະບົບ”", "ຕັດການເຊື່ອມຕໍ່ ແລ້ວເຊື່ອມຕໍ່ໃໝ່ (session 8 ຊົ່ວໂມງ)."],
];

function Copy({ value, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* insecure context: value is visible to select */ }
  };
  return (
    <span className="copy">
      <code className="mono">{label ?? value}</code>
      <button type="button" className="link" onClick={copy}>{done ? "ຄັດລອກແລ້ວ" : "ຄັດລອກ"}</button>
    </span>
  );
}

/* ---------- Software infrastructure: where each request travels ---------- */
function Box({ x, y, w, h, title, lines = [], tone = "cover" }) {
  return (
    <g className={`ib ib-${tone}`}>
      <rect x={x} y={y} width={w} height={h} rx="6" />
      <text x={x + w / 2} y={y + 24} className="ib-title">{title}</text>
      {lines.map((l, i) => <text key={l} x={x + w / 2} y={y + 44 + i * 16} className="ib-sub">{l}</text>)}
    </g>
  );
}
const Arrow = ({ d, label, lx, ly, tone = "", dashed }) => (
  <g className={`ia ${tone}`}>
    <path d={d} markerEnd={`url(#ah${tone ? "-" + tone : ""})`} strokeDasharray={dashed ? "5 4" : undefined} />
    {label && <text x={lx} y={ly} className="ia-label">{label}</text>}
  </g>
);

function InfraDiagram() {
  return (
    <div className="infra-wrap">
      <svg className="infra" viewBox="0 0 960 560" role="img"
        aria-label="ຜູ້ໃຊ້ ແລະ MetaMask ເຊື່ອມຜ່ານ Cloudflare HTTPS ເຂົ້າ cloudflared ເທິງ server, ໄປ nginx ທີ່ແຍກ /api ໄປ Node.js API ແລະ /rpc ໄປ Anvil blockchain; API ເກັບຂໍ້ມູນເຂົ້າລະຫັດໃນ PostgreSQL ແລະ ກວດສິດກັບ blockchain">
        <defs>
          {[["ah", "var(--cover)"], ["ah-chain", "var(--stamp)"], ["ah-data", "var(--ok)"]].map(([id, c]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* zones */}
        <rect x="16" y="60" width="210" height="330" rx="10" className="iz" />
        <text x="121" y="84" className="iz-label">ອຸປະກອນຜູ້ໃຊ້</text>
        <rect x="440" y="24" width="504" height="520" rx="10" className="iz" />
        <text x="692" y="48" className="iz-label">Server · Ubuntu 22.04 · 202.137.130.114</text>
        <rect x="612" y="64" width="324" height="468" rx="8" className="iz iz-docker" />
        <text x="774" y="86" className="iz-label">Docker Compose</text>

        {/* nodes */}
        <Box x={36} y={110} w={170} h={74} title="ໜ້າເວັບ MediChain" lines={["React + ethers.js"]} />
        <Box x={36} y={270} w={170} h={74} title="MetaMask" lines={["Wallet · ລົງນາມທຸລະກຳ"]} />
        <Box x={262} y={176} w={150} h={94} title="Cloudflare" lines={["HTTPS + Tunnel", "medichain.ivo-"]} tone="edge" />
        <text x="337" y="258" className="ib-sub">blockchain.org</text>
        <Box x={460} y={182} w={130} h={74} title="cloudflared" lines={["systemd service"]} tone="edge" />
        <Box x={628} y={182} w={292} h={74} title="web · nginx :80" lines={["React build · ແຍກ /api ແລະ /rpc"]} />
        <Box x={628} y={312} w={140} h={90} title="api · Node.js" lines={[":4000 · Express", "ກວດສິດ · AES-256"]} tone="data" />
        <Box x={780} y={312} w={140} h={90} title="chain · Anvil" lines={[":8545 · Chain 31337", "Smart Contract"]} tone="chain" />
        <Box x={628} y={442} w={140} h={74} title="db · PostgreSQL" lines={["ຂໍ້ມູນເຂົ້າລະຫັດ"]} tone="data" />
        <Box x={780} y={442} w={140} h={74} title="volume" lines={["chain state.json"]} tone="chain" />

        {/* wires */}
        <Arrow d="M121,184 L121,266" label="ຂໍລົງນາມ" lx={150} ly={230} />
        <Arrow d="M206,147 C236,147 236,206 258,206" label="/ · /api" lx={240} ly={128} />
        <Arrow d="M206,307 C236,307 236,244 258,244" label="/rpc" lx={236} ly={322} tone="chain" />
        <Arrow d="M412,219 L456,219" label="Tunnel" lx={434} ly={210} />
        <Arrow d="M590,219 L624,219" label=":80" lx={607} ly={210} />
        <Arrow d="M698,256 L698,308" label="/api" lx={722} ly={288} tone="data" />
        <Arrow d="M850,256 L850,308" label="/rpc" lx={874} ly={288} tone="chain" />
        <Arrow d="M768,357 L776,357" tone="chain" />
        <text x="774" y="420" className="ia-label">ກວດສິດ hasAccess()</text>
        <Arrow d="M698,402 L698,438" tone="data" />
        <Arrow d="M850,402 L850,438" tone="chain" dashed />
      </svg>
    </div>
  );
}

const COMPONENTS = [
  ["ໜ້າເວັບ", "React + Vite + ethers.js", "—", "ປຶ້ມຄົນເຈັບ, ສິດ, ສະແກນ QR, ກວດເອກະສານ"],
  ["MetaMask", "Browser extension / ແອັບມືຖື", "—", "ເກັບ key, ລົງນາມເຂົ້າສູ່ລະບົບ ແລະ ທຸລະກຳ"],
  ["Cloudflare Tunnel", "cloudflared (systemd)", "443 → 80", "HTTPS ສາທາລະນະ ໂດຍບໍ່ຕ້ອງເປີດ port ເທິງ server"],
  ["web", "nginx 1.27", "80", "ສົ່ງໜ້າເວັບ, proxy /api ແລະ /rpc"],
  ["api", "Node.js 22 + Express", "4000", "ຢືນຢັນລາຍເຊັນ, ກວດສິດເທິງ chain ທຸກຄັ້ງ, ເຂົ້າ/ຖອດລະຫັດ, audit log, faucet"],
  ["db", "PostgreSQL 16", "5432 (ພາຍໃນ)", "ຂໍ້ມູນປົກ ແລະ ບັນທຶກການກວດ (AES-256-GCM), ໂຮງໝໍ, ບຸກຄະລາກອນ"],
  ["chain", "Anvil (Foundry) + Solidity", "8545 (ພາຍໃນ)", "ບົດບາດ, ສິດ, hash ຂອງເລກປຶ້ມ ແລະ ບັນທຶກ; ເກັບ state ລົງ disk"],
];

const PATHS = [
  ["ທ່ານໝໍເປີດປຶ້ມ", [
    "ໜ້າເວັບ → Cloudflare → nginx → api: GET /api/patients/MC-…",
    "api ຖາມ chain: hasAccess(ຄົນເຈັບ, ທ່ານໝໍ, ປະເພດຂໍ້ມູນ)",
    "ມີສິດ → ອ່ານ db ແລ້ວຖອດລະຫັດ → ສົ່ງສະເພາະປະເພດທີ່ໄດ້ຮັບອະນຸຍາດ · ບໍ່ມີສິດ → 403",
  ]],
  ["ທ່ານໝໍບັນທຶກການກວດ", [
    "api ເຂົ້າລະຫັດບັນທຶກ ເກັບລົງ db ແລະ ຄິດໄລ່ hash",
    "MetaMask ລົງນາມ anchorRecord(hash) → /rpc → chain",
    "ໜ້າເວັບອ່ານ chain ຢືນຢັນ → ສະແດງຕາປະທັບແດງ",
  ]],
];

export default function Guide() {
  const [netMsg, setNetMsg] = useState(null);
  const addNetwork = async () => {
    if (!hasWallet()) return setNetMsg("ບໍ່ພົບ MetaMask ໃນ browser ນີ້.");
    try { await switchToHardhat(); setNetMsg("ເພີ່ມ ແລະ ສະຫຼັບ Network ແລ້ວ."); } catch (e) { setNetMsg(e.message); }
  };

  return (
    <article className="guide">
      <header className="guide-head">
        <h1>ຄູ່ມືການໃຊ້ງານ</h1>
        <p>ຕັ້ງຄ່າ MetaMask ຄັ້ງດຽວ, ຈາກນັ້ນທຸກຢ່າງເຮັດຜ່ານໜ້າເວັບນີ້. ລະບົບທົດລອງ — ໃຊ້ຂໍ້ມູນຈຳລອງເທົ່ານັ້ນ.</p>
      </header>

      <section className="card">
        <h2>Flow ການເຮັດວຽກ</h2>
        <p className="fine">
          <span className="who-chip patient">ຄົນເຈັບ</span> <span className="who-chip staff">ແພດ / ພະຍາບານ</span>{" "}
          <span className="chain-tag">⛓ ຂຽນລົງ Blockchain — MetaMask ຂໍ Confirm</span>
        </p>
        <ol className="flow">
          {FLOW.map((s) => (
            <li key={s.title} className={`flow-step ${s.who}`}>
              <span className={`who-chip ${s.who}`}>{WHO[s.who]}</span>
              <b>{s.title}</b>
              <p>{s.body}</p>
              {s.chain && <span className="chain-tag">⛓ {s.chain}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Software Infrastructure</h2>
        <p className="fine">
          <span className="leg web">ການເຊື່ອມຕໍ່ເວັບ</span> <span className="leg data">ຂໍ້ມູນທາງການແພດ (off-chain, ເຂົ້າລະຫັດ)</span>{" "}
          <span className="leg chain">Blockchain (on-chain: ສິດ ແລະ hash)</span>
        </p>
        <InfraDiagram />
        <div className="paths">
          {PATHS.map(([title, steps]) => (
            <div key={title}>
              <h3>{title}</h3>
              <ol className="steps">{steps.map((t) => <li key={t}>{t}</li>)}</ol>
            </div>
          ))}
        </div>
        <div className="table-wrap">
          <table className="audit">
            <thead><tr><th>ສ່ວນປະກອບ</th><th>ເຕັກໂນໂລຊີ</th><th>Port</th><th>ໜ້າທີ່</th></tr></thead>
            <tbody>{COMPONENTS.map(([n, t, p, r]) => <tr key={n}><td><b>{n}</b></td><td>{t}</td><td className="mono small">{p}</td><td>{r}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="fine">ຊື່, ວິນິດໄສ, ຢາ ແລະ ຜົນກວດ ບໍ່ເຄີຍຂຶ້ນ Blockchain — ເທິງ chain ມີພຽງ wallet, ສິດ ແລະ hash.</p>
      </section>

      <ContractGuide />

      <section className="card">
        <h2>1. ເພີ່ມ Network ໃນ MetaMask</h2>
        <p>ຕິດຕັ້ງ MetaMask ຈາກ <a href="https://metamask.io" target="_blank" rel="noreferrer">metamask.io</a>. ແນະນຳໃຫ້ໃຊ້ wallet ແຍກສຳລັບທົດລອງ.</p>
        <div className="row">
          <button className="btn primary" onClick={addNetwork}>ເພີ່ມ Network ອັດຕະໂນມັດ</button>
          {netMsg && <span className="fine" role="status">{netMsg}</span>}
        </div>
        <p className="fine">ຫຼື ເພີ່ມເອງ: MetaMask → ເມນູ Network → Add a custom network</p>
        <dl className="kv net-values">
          <dt>Network name</dt><dd><Copy value="MediChain POC" /></dd>
          <dt>RPC URL</dt><dd><Copy value={RPC_URL} /></dd>
          <dt>Chain ID</dt><dd><Copy value={String(CHAIN_ID)} /></dd>
          <dt>Currency symbol</dt><dd><Copy value="ETH" /></dd>
        </dl>
      </section>

      <section className="card">
        <h2>2. Import ບັນຊີທົດລອງ</h2>
        <p>MetaMask → ກົດຊື່ບັນຊີ → <b>Add account or hardware wallet</b> → <b>Import account</b> → ວາງ Private Key.</p>
        <div className="notice deny small">ເປັນ key ມາດຕະຖານຂອງ Hardhat/Anvil ທີ່ທຸກຄົນຮູ້ — ໃຊ້ສະເພາະ Network ທົດລອງນີ້, ຫ້າມສົ່ງເງິນແທ້ເຂົ້າ.</div>
        <table className="audit accounts">
          <thead><tr><th>#</th><th>ບົດບາດ</th><th>Private Key</th></tr></thead>
          <tbody>
            {ACCOUNTS.map(([n, role, key]) => (
              <tr key={n}><td>{n}</td><td>{role}</td><td><Copy value={key} label={`${key.slice(0, 10)}…${key.slice(-6)}`} /></td></tr>
            ))}
          </tbody>
        </table>
        <p className="fine">ໃຊ້ wallet ຂອງຕົນເອງໄດ້ — ກົດ “ຂໍ 0.1 ETH ທົດລອງ” ໃນໜ້າທຳອິດ (ຂໍໄດ້ທຸກ 30 ວິນາທີ ຈົນມີ 1 ETH). ແພດ/ພະຍາບານ ຕ້ອງໃຫ້ Admin ກຳນົດບົດບາດກ່ອນ.</p>
      </section>

      <section className="card">
        <h2>3. ເຂົ້າສູ່ລະບົບ</h2>
        <ol className="steps">
          <li>ກົດ <b>ເຊື່ອມຕໍ່ MetaMask</b> → ເລືອກບັນຊີ → Connect.</li>
          <li>MetaMask ຂໍ <b>Sign</b> ຂໍ້ຄວາມ “Sign in to MediChain” — ບໍ່ເສຍຄ່າທຳນຽມ.</li>
          <li>ແຖບເທິງສະແດງ Network, address ແລະ ບົດບາດຂອງທ່ານ. ປ່ຽນບັນຊີ: ຕັດການເຊື່ອມຕໍ່ → ສະຫຼັບໃນ MetaMask → ເຊື່ອມຕໍ່ໃໝ່.</li>
        </ol>
      </section>

      <section className="card">
        <h2>ໃຊ້ງານຕາມບົດບາດ</h2>
        <div className="roles">
          {ROLES.map(([role, items]) => (
            <div key={role}>
              <h3>{role}</h3>
              <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>ແກ້ບັນຫາ</h2>
        <dl className="trouble">
          {TROUBLE.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}
        </dl>
      </section>
    </article>
  );
}
