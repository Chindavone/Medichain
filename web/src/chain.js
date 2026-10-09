// Wallet, contract and API plumbing. Reads go straight to the Hardhat RPC; writes go through MetaMask.
import { ethers } from "ethers";
import deployment from "./deployment.json";

export const CHAIN_ID = deployment.chainId;
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

const rpc = new ethers.JsonRpcProvider(deployment.rpcUrl, CHAIN_ID, { staticNetwork: true });
export const reader = new ethers.Contract(deployment.address, ABI, rpc);
export const contractAddress = deployment.address;

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

export async function switchToHardhat() {
  const chainId = ethers.toQuantity(CHAIN_ID);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId, chainName: "Hardhat Local", rpcUrls: [deployment.rpcUrl], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }],
    });
  }
}

// AT-08: never hand a transaction to a wallet sitting on the wrong network.
export async function assertNetwork() {
  if ((await currentChainId()) !== CHAIN_ID) throw new WrongNetwork();
}
export async function writer() {
  await assertNetwork();
  const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
  return reader.connect(signer);
}
export class WrongNetwork extends Error {
  constructor() { super("MetaMask ບໍ່ໄດ້ຢູ່ Hardhat Local (31337). ສະຫຼັບ Network ແລ້ວລອງໃໝ່."); }
}

export const isRejection = (e) => e?.code === "ACTION_REJECTED" || e?.code === 4001 || e?.info?.error?.code === 4001;

export function txError(e) {
  if (isRejection(e)) return "ຍົກເລີກໃນ MetaMask — ບໍ່ມີການປ່ຽນແປງ.";
  if (e instanceof WrongNetwork) return "MetaMask ບໍ່ໄດ້ຢູ່ Hardhat Local (31337). ສະຫຼັບ Network ແລ້ວລອງໃໝ່.";
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

export async function signIn(address) {
  const cached = sessionStorage.getItem(`mc-token-${address}`);
  if (cached) {
    setToken(cached);
    try { return await api("/me"); } catch (e) { if (e.status !== 401) throw e; }
  }
  const { message } = await api("/auth/nonce", { method: "POST", body: { address } });
  const signature = await window.ethereum.request({ method: "personal_sign", params: [ethers.hexlify(ethers.toUtf8Bytes(message)), address] });
  const { token: t } = await api("/auth/verify", { method: "POST", body: { address, signature } });
  sessionStorage.setItem(`mc-token-${address}`, t);
  setToken(t);
  return api("/me");
}

export function signOut(address) {
  sessionStorage.removeItem(`mc-token-${address}`);
  setToken(null);
}

export const hashText = (text) => ethers.id(text);
export const idHash = (pid) => ethers.id(pid);
