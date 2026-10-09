// Wallet, contract and API plumbing. Reads go straight to the Hardhat RPC; writes go through MetaMask.
import { ethers } from "ethers";
// Contract address and chain id come from the API at startup, so one web build works on any server.
// The chain RPC is always proxied at /rpc (vite in dev, nginx in production).
export let CHAIN_ID = null;
export let reader = null;
export let contractAddress = null;
export const RPC_URL = `${location.origin}/rpc`;
export const SCOPES = [
  { bit: 1, label: "ການກວດ ແລະ ຢາ", hint: "ອາການ, ວິນິດໄສ, ຢາ, ແຜນການຮັກສາ" },
  { bit: 2, label: "ສັນຍານຊີບ", hint: "ຄວາມດັນ, ຊີບພະຈອນ, ອຸນຫະພູມ, ນ້ຳໜັກ" },
  { bit: 4, label: "ຜົນກວດ", hint: "ຜົນກວດເລືອດ ແລະ ຫ້ອງວິເຄາະ" },
];
export const KIND_SCOPE = { consult: 1, vitals: 2, lab: 4 };
export const ROLE_LABEL = { none: "ຄົນເຈັບ", doctor: "ແພດ", nurse: "ພະຍາບານ", admin: "ຜູ້ບໍລິຫານ" };

const ABI = [
  "function roleOf(address) view returns (uint8)",
  "function grants(address, address) view returns (uint8 scopes, uint64 expires)",
  "function anchors(bytes32) view returns (address patient, address author, uint64 anchoredAt)",
  "function setRole(address account, uint8 role)",
  "function registerPatient(bytes32 idHash)",
  "function grantAccess(address grantee, uint8 scopes, uint64 expires)",
  "function revokeAccess(address grantee)",
  "function anchorRecord(address patient, bytes32 hash, uint8 scope)",
  "event RoleSet(address indexed account, uint8 role, address indexed by)",
  "event PatientRegistered(address indexed patient, bytes32 indexed idHash)",
  "event AccessGranted(address indexed patient, address indexed grantee, uint8 scopes, uint64 expires)",
  "event AccessRevoked(address indexed patient, address indexed grantee)",
  "event RecordAnchored(address indexed patient, bytes32 indexed hash, address indexed author)",
];

export async function loadConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("API not reachable");
  const cfg = await res.json();
  CHAIN_ID = cfg.chainId;
  contractAddress = cfg.address;
  reader = new ethers.Contract(cfg.address, ABI, new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true }));
}

export const hasWallet = () => typeof window !== "undefined" && !!window.ethereum;
export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const laoDate = (d) => new Date(d).toLocaleDateString("en-GB");
export const laoDateTime = (d) => new Date(d).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });

export async function currentChainId() {
  return Number(await window.ethereum.request({ method: "eth_chainId" }));
}

export async function requestAccount() {
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
  return ethers.getAddress(account);
}

const addNetwork = () => window.ethereum.request({
  method: "wallet_addEthereumChain",
  params: [{ chainId: ethers.toQuantity(CHAIN_ID), chainName: "MediChain POC", rpcUrls: [RPC_URL], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }],
});

export async function switchToHardhat() {
  // Same chain id but another chain (e.g. a local node at 127.0.0.1:8545): offer this server's RPC.
  if ((await walletChainStatus()) === "wrongRpc") return addNetwork();
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ethers.toQuantity(CHAIN_ID) }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await addNetwork();
  }
}

// Chain id alone can't tell two dev chains apart (every Hardhat/Anvil node is 31337),
// so also compare block 0 as seen by the wallet with block 0 as seen by this server.
let serverGenesis = null;
export async function walletChainStatus() {
  if ((await currentChainId()) !== CHAIN_ID) return "wrongId";
  serverGenesis ??= (await reader.runner.getBlock(0)).hash;
  const g = await window.ethereum.request({ method: "eth_getBlockByNumber", params: ["0x0", false] });
  return g?.hash === serverGenesis ? "ok" : "wrongRpc";
}

// AT-08: never hand a transaction to a wallet sitting on the wrong network.
export async function assertNetwork() {
  const status = await walletChainStatus();
  if (status !== "ok") throw new WrongNetwork(status);
}
export async function writer() {
  await assertNetwork();
  const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
  return reader.connect(signer);
}
export const networkMessage = (status) => status === "wrongRpc"
  ? `MetaMask ຢູ່ Chain ID ${CHAIN_ID} ແຕ່ RPC ຊີ້ໄປ Blockchain ອື່ນ (ເຊັ່ນ 127.0.0.1:8545). ແກ້ RPC URL ຂອງ Network ນີ້ເປັນ ${RPC_URL} ແລ້ວລອງໃໝ່.`
  : `MetaMask ບໍ່ໄດ້ຢູ່ Network ຂອງລະບົບ (Chain ID ${CHAIN_ID}). ສະຫຼັບ Network ແລ້ວລອງໃໝ່.`;
export class WrongNetwork extends Error {
  constructor(status) { super(networkMessage(status)); }
}

export const isRejection = (e) => e?.code === "ACTION_REJECTED" || e?.code === 4001 || e?.info?.error?.code === 4001;

export function txError(e) {
  if (isRejection(e)) return "ຍົກເລີກໃນ MetaMask — ບໍ່ມີການປ່ຽນແປງ.";
  if (e instanceof WrongNetwork) return e.message;
  const reason = e?.reason || e?.shortMessage || e?.message || "Unknown error";
  return `ທຸລະກຳບໍ່ສຳເລັດ: ${reason}`;
}

// ---- API ----
let token = null;
export const setToken = (t) => { token = t; };

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, body: body && JSON.stringify(body),
      headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    });
  } catch {
    throw new Error("ເຊື່ອມຕໍ່ Backend API ບໍ່ໄດ້. ກວດວ່າ `npm run server` ກຳລັງເຮັດວຽກ.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `API error ${res.status}`), { status: res.status });
  return data;
}

// Session token per wallet, kept across reloads until it expires (8h) or the user disconnects.
const store = {
  get: (a) => { try { return localStorage.getItem(`mc-token-${a}`); } catch { return null; } },
  set: (a, t) => { try { localStorage.setItem(`mc-token-${a}`, t); } catch {} },
  del: (a) => { try { localStorage.removeItem(`mc-token-${a}`); } catch {} },
};

// Resume without any MetaMask prompt: only if the wallet is still connected to this site and the token is valid.
export async function restoreSession() {
  if (!hasWallet()) return null;
  const [account] = await window.ethereum.request({ method: "eth_accounts" });
  const address = account && ethers.getAddress(account);
  const cached = address && store.get(address);
  if (!cached) return null;
  setToken(cached);
  try { return { address, me: await api("/me") }; } catch (e) {
    if (e.status === 401) { store.del(address); setToken(null); return null; }
    throw e;
  }
}

export async function signIn(address) {
  const cached = store.get(address);
  if (cached) {
    setToken(cached);
    try { return await api("/me"); } catch (e) { if (e.status !== 401) throw e; }
  }
  const { message } = await api("/auth/nonce", { method: "POST", body: { address } });
  const signature = await window.ethereum.request({ method: "personal_sign", params: [ethers.hexlify(ethers.toUtf8Bytes(message)), address] });
  const { token: t } = await api("/auth/verify", { method: "POST", body: { address, signature } });
  store.set(address, t);
  setToken(t);
  return api("/me");
}

export function signOut(address) {
  store.del(address);
  setToken(null);
}

export const hashText = (text) => ethers.id(text);
export const idHash = (pid) => ethers.id(pid);
