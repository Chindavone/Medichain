// The guide's Smart Contract section. Code is the real contracts/MediChain.sol, bundled as text,
// so what users read is always what was deployed.
import source from "../../contracts/MediChain.sol?raw";
import { CHAIN_ID, contractAddress } from "./chain.js";

const LINES = source.split("\n");

// From the line containing `start` (plus its /// doc comment) to `end`: a substring, or "}" for the
// end of the function body (closing brace at contract indent).
function snippet(start, end) {
  let i = LINES.findIndex((l) => l.includes(start));
  if (i < 0) return null;
  while (i > 0 && LINES[i - 1].trim().startsWith("///")) i--;
  const j = end === "}"
    ? LINES.findIndex((l, k) => k > i && l === "    }")
    : LINES.findIndex((l, k) => k >= i && l.includes(end));
  return j < 0 ? null : { from: i + 1, lines: LINES.slice(i, j + 1) };
}

const PARTS = [
  {
    title: "ບົດບາດ ແລະ ປະເພດຂໍ້ມູນ", start: "enum Role", end: "LABS = 4",
    text: [
      "Role ກຳນົດບົດບາດຂອງ wallet: None (ຄົນເຈັບ/ບໍ່ມີບົດບາດ), Doctor, Nurse, Admin.",
      "ປະເພດຂໍ້ມູນເປັນ bit: ການກວດ = 1, ສັນຍານຊີບ = 2, ຜົນກວດ = 4. ລວມກັນໄດ້ ເຊັ່ນ 1 + 2 = 3 ໝາຍເຖິງ ການກວດ ແລະ ສັນຍານຊີບ.",
    ],
  },
  {
    title: "ຂໍ້ມູນທີ່ເກັບເທິງ Blockchain", start: "struct Grant", end: "mapping(bytes32 => Anchor)",
    text: [
      "roleOf — ບົດບາດຂອງແຕ່ລະ wallet.",
      "patientOf / idHashOf — ຈັບຄູ່ hash ຂອງເລກປຶ້ມ (keccak256) ກັບ wallet ຄົນເຈັບ. ເກັບ hash ບໍ່ແມ່ນເລກປຶ້ມຕົວຈິງ.",
      "grants[ຄົນເຈັບ][ຜູ້ໄດ້ຮັບສິດ] — ປະເພດຂໍ້ມູນທີ່ອະນຸຍາດ ແລະ ເວລາໝົດອາຍຸ.",
      "anchors[hash] — ຫຼັກຖານວ່າບັນທຶກໃດຖືກບັນທຶກ, ໂດຍໃຜ, ເມື່ອໃດ.",
      "ບໍ່ມີຊື່, ວິນິດໄສ ຫຼື ຢາ ຢູ່ໃນ contract ເລີຍ — ຂໍ້ມູນເຫຼົ່ານັ້ນຢູ່ໃນ PostgreSQL ແບບເຂົ້າລະຫັດ.",
    ],
  },
  {
    title: "Events — ປະຫວັດທີ່ລຶບບໍ່ໄດ້", start: "event RoleSet", end: "event RecordAnchored",
    text: [
      "ທຸກການປ່ຽນແປງສຳຄັນປ່ອຍ event ລົງ blockchain. ໜ້າ “ປະຫວັດການເຂົ້າເຖິງ” ອ່ານ events ເຫຼົ່ານີ້ (ເຄື່ອງໝາຍ ⛓).",
      "indexed ຊ່ວຍໃຫ້ຄົ້ນຫາໄວ ເຊັ່ນ “ທຸກສິດທີ່ຄົນເຈັບຄົນນີ້ເຄີຍເປີດ”.",
    ],
  },
  {
    title: "constructor — ຜູ້ deploy ເປັນ Admin", start: "constructor()", end: "}",
    text: ["wallet ທີ່ deploy contract ກາຍເປັນ owner ແລະ Admin ຄົນທຳອິດ. owner ປ່ຽນບໍ່ໄດ້."],
  },
  {
    title: "setRole — Admin ກຳນົດບົດບາດ", start: "function setRole", end: "}",
    text: [
      "ສະເພາະ Admin ເອີ້ນໄດ້. ປ່ຽນບົດບາດ owner ບໍ່ໄດ້.",
      "wallet ທີ່ລົງທະບຽນເປັນຄົນເຈັບແລ້ວ ເປັນບຸກຄະລາກອນບໍ່ໄດ້. ສະເພາະ owner ທີ່ແຕ່ງຕັ້ງ Admin ຄົນໃໝ່ໄດ້.",
    ],
  },
  {
    title: "registerPatient — ລົງທະບຽນປຶ້ມ", start: "function registerPatient", end: "}",
    text: [
      "ຄົນເຈັບລົງທະບຽນ hash ຂອງເລກປຶ້ມກັບ wallet ຕົນເອງ: 1 wallet = 1 ປຶ້ມ, ເລກປຶ້ມຊ້ຳບໍ່ໄດ້.",
      "ຖ້າລົງທະບຽນຊ້ຳ ຈະໄດ້ error “already registered” (ເບິ່ງ ແກ້ບັນຫາ).",
    ],
  },
  {
    title: "grantAccess — ຄົນເຈັບເປີດສິດ", start: "function grantAccess", end: "}",
    text: [
      "msg.sender ຕ້ອງເປັນຄົນເຈັບ — ສະນັ້ນບໍ່ມີໃຜເປີດສິດແທນຄົນເຈັບໄດ້, ລວມທັງ Admin.",
      "ຜູ້ໄດ້ຮັບສິດຕ້ອງເປັນແພດ ຫຼື ພະຍາບານ, ປະເພດຂໍ້ມູນ 1–7, ວັນໝົດອາຍຸຕ້ອງຢູ່ໃນອະນາຄົດ.",
    ],
  },
  {
    title: "revokeAccess — ຖອນສິດ", start: "function revokeAccess", end: "}",
    text: ["ລຶບສິດທີ່ຄົນເຈັບເຄີຍເປີດ. ໃຊ້ grants[msg.sender] — ຄົນອື່ນຖອນສິດແທນ ຫຼື ຖອນສິດຂອງຄົນເຈັບອື່ນບໍ່ໄດ້."],
  },
  {
    title: "hasAccess — ກວດສິດ (API ເອີ້ນທຸກຄັ້ງ)", start: "function hasAccess", end: "}",
    text: [
      "ເປັນ view: ອ່ານຢ່າງດຽວ, ບໍ່ເສຍຄ່າທຳນຽມ. Server ເອີ້ນກ່ອນສົ່ງຂໍ້ມູນທຸກຄັ້ງ.",
      "ຄົນເຈັບເບິ່ງປຶ້ມຕົນເອງໄດ້ສະເໝີ. ບຸກຄະລາກອນຕ້ອງ: ຍັງມີບົດບາດ, ມີ bit ຂອງປະເພດຂໍ້ມູນນັ້ນ, ແລະ ສິດຍັງບໍ່ໝົດອາຍຸ.",
      "ຖ້າ Admin ຖອນບົດບາດ, ຜູ້ນັ້ນເສຍສິດທຸກປຶ້ມທັນທີ ເຖິງວ່າຄົນເຈັບຍັງບໍ່ຖອນ.",
    ],
  },
  {
    title: "anchorRecord — ປະທັບຕາບັນທຶກ", start: "function anchorRecord", end: "}",
    text: [
      "ຫຼັງ API ບັນທຶກ, MetaMask ຂອງທ່ານໝໍລົງນາມສົ່ງ hash ຂອງບັນທຶກມາທີ່ນີ້ → ໄດ້ຕາປະທັບແດງ.",
      "ແພດປະທັບໄດ້ທຸກປະເພດ, ພະຍາບານສະເພາະສັນຍານຊີບ, ແລະ ຕ້ອງມີສິດໃນປຶ້ມນັ້ນ. hash ດຽວກັນປະທັບຊ້ຳບໍ່ໄດ້.",
      "ຖ້າໃຜແກ້ໄຂບັນທຶກໃນຖານຂໍ້ມູນພາຍຫຼັງ, hash ຈະບໍ່ກົງ → ໜ້າ “ກວດສອບເອກະສານ” ຈະແຈ້ງ “ບໍ່ພົບ Hash”.",
    ],
  },
];

const KEYWORDS = /\b(pragma|solidity|contract|function|returns?|require|emit|if|external|public|view|memory|immutable|constant|event|struct|enum|mapping|indexed|delete|constructor)\b/;
const TYPES = /\b(address|uint8|uint64|bytes32|bool|Role|Grant|Anchor)\b/;
const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b[A-Za-z_]\w*\b)|(\b\d+\b)/g;

// Minimal Solidity highlighting: comments, strings, keywords, types, numbers.
function Line({ text }) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [tok, comment, str, word, num] = m;
    const cls = comment ? "c" : str ? "s" : num ? "n" : KEYWORDS.test(word) ? "k" : TYPES.test(word) ? "t" : null;
    out.push(cls ? <span key={m.index} className={`sol-${cls}`}>{tok}</span> : tok);
    last = m.index + tok.length;
  }
  out.push(text.slice(last));
  return out;
}

function Code({ from, lines }) {
  return (
    <pre className="sol"><code>
      {lines.map((l, i) => (
        <div key={i} className="sol-line"><span className="sol-no">{from + i}</span><span><Line text={l} /></span></div>
      ))}
    </code></pre>
  );
}

export default function ContractGuide() {
  const download = () => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/plain" }));
    Object.assign(document.createElement("a"), { href: url, download: "MediChain.sol" }).click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="card">
      <h2>Smart Contract</h2>
      <p>
        <span className="mono">MediChain.sol</span> (Solidity 0.8.24) ເປັນກົດລະບຽບທີ່ທຸກຄົນກວດສອບໄດ້ ແລະ ບໍ່ມີໃຜແກ້ໄຂໄດ້ຫຼັງ deploy:
        ໃຜມີບົດບາດຫຍັງ, ໃຜເບິ່ງປຶ້ມໃດໄດ້, ແລະ ບັນທຶກໃດຖືກປະທັບຕາແລ້ວ.
      </p>
      <dl className="kv contract-meta">
        <dt>Contract address</dt><dd className="mono small">{contractAddress}</dd>
        <dt>Chain ID</dt><dd className="mono small">{CHAIN_ID}</dd>
      </dl>
      <div className="contract-parts">
        {PARTS.map((p) => {
          const s = snippet(p.start, p.end);
          if (!s) return null;
          return (
            <article key={p.title} className="contract-part">
              <div className="contract-text">
                <h3>{p.title}</h3>
                <span className="fine">ແຖວ {s.from}–{s.from + s.lines.length - 1}</span>
                <ul>{p.text.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <Code {...s} />
            </article>
          );
        })}
      </div>
      <details className="contract-full">
        <summary>ເບິ່ງ code ທັງໝົດ ({LINES.length} ແຖວ)</summary>
        <Code from={1} lines={LINES} />
      </details>
      <button className="btn small" onClick={download}>ດາວໂຫຼດ MediChain.sol</button>
    </section>
  );
}
