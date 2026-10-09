import { useState } from "react";
import { CHAIN_ID, RPC_URL, hasWallet, switchToHardhat } from "./chain.js";

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
    "ປຶ້ມຄົນເຈັບ — ສະແກນ QR ຂອງຄົນເຈັບດ້ວຍກ້ອງມືຖື (ເປີດໃນແອັບ MetaMask) ຫຼື ໃສ່ເລກປຶ້ມເອງ. ແຖບສີຟ້າບອກວ່າທ່ານມີສິດປະເພດໃດ.",
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
  ["“Network fee” ສີແດງ, ກົດ Confirm ບໍ່ໄດ້", "Wallet ບໍ່ມີ ETH ທົດລອງ — ໃຊ້ບັນຊີ #0–#5 ຫຼື ຂໍໃຫ້ຜູ້ດູແລເຕີມ."],
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
        <p className="fine">ໃຊ້ wallet ຂອງຕົນເອງໄດ້ ແຕ່ຕ້ອງມີ ETH ທົດລອງ — ຂໍໃຫ້ຜູ້ດູແລລະບົບເຕີມໃຫ້. ແພດ/ພະຍາບານ ຕ້ອງໃຫ້ Admin ກຳນົດບົດບາດກ່ອນ.</p>
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
