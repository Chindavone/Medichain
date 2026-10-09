# MediChain — ປຶ້ມຕິດຕາມກວດພະຍາດ (Web3)

Prototype ຕາມ SRS v1.0. ໃຊ້ຂໍ້ມູນຈຳລອງເທົ່ານັ້ນ.

| ສ່ວນ | ໄຟລ໌ |
|---|---|
| Smart Contract (ສິດ, Patient ID hash, Record hash) | `contracts/MediChain.sol` |
| Backend API (Node + PostgreSQL, AES-256-GCM, ກວດສິດເທິງ chain ທຸກ request) | `server/app.js` |
| Frontend (React + ethers + MetaMask) | `web/src/` |
| Tests (Contract + API, AT-02…AT-10) | `test/MediChain.test.js` |

**On-chain:** wallet, ບົດບາດ, ສິດ (scope + ວັນໝົດອາຍຸ), `keccak256(patientId)`, hash ຂອງບັນທຶກ, events.
**Off-chain (ເຂົ້າລະຫັດ):** ຂໍ້ມູນປົກປຶ້ມ, ອາການ, ວິນິດໄສ, ຢາ, ຜົນກວດ.

## ແລ່ນລະບົບ

```bash
npm install && npm --prefix web install
cp .env.example .env        # ໃສ່ DATA_KEY ແລະ SESSION_SECRET (openssl rand -hex 32)
npm run db                  # PostgreSQL (docker, port 5433)
npm run chain               # Hardhat node — terminal ແຍກ
npm run deploy              # deploy contract + ກຳນົດບົດບາດ staff ທົດລອງ (ລ້າງ DB ໃໝ່)
npm run server              # API :4000 — terminal ແຍກ
npm run web                 # http://localhost:5173
npm test                    # ໃຊ້ database medichain_test ແຍກ
```

ຫຼັງ restart Hardhat node ຕ້ອງ `npm run deploy` ແລະ restart server ໃໝ່.

## ເຊື່ອມຕໍ່ MetaMask

### 1. ຕິດຕັ້ງ MetaMask
ຕິດຕັ້ງ extension ຈາກ [metamask.io](https://metamask.io) (Chrome, Brave, Edge ຫຼື Firefox) ແລ້ວສ້າງ wallet ໃໝ່.
ສຳລັບການທົດລອງ ແນະນຳໃຫ້ສ້າງ wallet ແຍກ, ບໍ່ໃຊ້ wallet ທີ່ມີເງິນແທ້.

### 2. ເພີ່ມ Network
ວິທີງ່າຍສຸດ: ເປີດເວັບ → ກົດ **ເຊື່ອມຕໍ່ MetaMask** → ຖ້າຂຶ້ນແຖບແດງ "Network ຜິດ" ໃຫ້ກົດ **ສະຫຼັບ Network**, MetaMask ຈະຖາມເພີ່ມ Network ໃຫ້ອັດຕະໂນມັດ.

ຫຼື ເພີ່ມເອງ: MetaMask → ເມນູ Network → **Add a custom network**

| ຊ່ອງ | Server (POC) | ເຄື່ອງພັດທະນາ |
|---|---|---|
| Network name | MediChain POC | Hardhat Local |
| RPC URL | `https://<domain>/rpc` | `http://127.0.0.1:8545` |
| Chain ID | `31337` | `31337` |
| Currency symbol | `ETH` | `ETH` |

### 3. ເພີ່ມບັນຊີທົດລອງ
MetaMask → ກົດຊື່ບັນຊີ → **Add account or hardware wallet** → **Import account** → ວາງ Private Key:

| # | ບົດບາດ | Address | Private Key |
|---|---|---|---|
| 0 | Admin | `0xf39F…2266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 1 | ແພດ (ສົມພອນ) | `0x7099…79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 2 | ແພດ (ວິໄລພອນ) | `0x3C44…93BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| 3 | ພະຍາບານ (ດາວວອນ) | `0x90F7…b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| 4 | ຄົນເຈັບ | `0x15d3…6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| 5 | ຄົນເຈັບ | `0x9965…A4dc` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` |

> ເປັນ key ມາດຕະຖານຂອງ Hardhat/Anvil ທີ່ທຸກຄົນຮູ້ — ໃຊ້ສະເພາະ Network ທົດລອງນີ້, ຫ້າມສົ່ງເງິນແທ້ເຂົ້າ.

**ໃຊ້ wallet ຂອງຕົນເອງ:** ໄດ້ ແຕ່ຕ້ອງມີ ETH ທົດລອງຈ່າຍຄ່າທຳນຽມ. ຜູ້ດູແລ server ເຕີມໃຫ້ດ້ວຍ (ປ່ຽນ `<ADDRESS>`):

```bash
curl -s -X POST localhost/rpc -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"anvil_setBalance","params":["<ADDRESS>","0x56BC75E2D63100000"]}'
```

ຄົນເຈັບໃຊ້ wallet ໃດກໍ່ໄດ້. ແພດ/ພະຍາບານ ຕ້ອງໃຫ້ Admin ກຳນົດບົດບາດໃຫ້ wallet ນັ້ນກ່ອນ.

### 4. ເຂົ້າສູ່ລະບົບ
1. ເປີດເວັບ → **ເຊື່ອມຕໍ່ MetaMask** → ເລືອກບັນຊີ → **Connect**.
2. MetaMask ຂໍ **Sign** ຂໍ້ຄວາມ "Sign in to MediChain" — ບໍ່ເສຍຄ່າທຳນຽມ, ເປັນການຢືນຢັນວ່າທ່ານເປັນເຈົ້າຂອງ wallet.
3. ແຖບເທິງສະແດງ ● Network, address ແລະ ບົດບາດ/ຊື່ ຂອງທ່ານ.

ປ່ຽນບັນຊີ: ກົດ **ຕັດການເຊື່ອມຕໍ່** → ສະຫຼັບບັນຊີໃນ MetaMask → ເຊື່ອມຕໍ່ໃໝ່.

## ຄູ່ມືການໃຊ້ງານ

ທຸກການກະທຳທີ່ປ່ຽນຂໍ້ມູນເທິງ Blockchain ຈະເປີດ MetaMask ໃຫ້ກົດ **Confirm**. ສະຖານະສະແດງຢູ່ມຸມຂວາລຸ່ມ:
*ລໍຖ້າລົງນາມ → ກຳລັງສົ່ງ → ສຳເລັດ (block #)*, ຫຼື *ຍົກເລີກ* ຖ້າກົດ Reject.

### ຄົນເຈັບ
| ແຖບ | ເຮັດຫຍັງໄດ້ |
|---|---|
| **ປຶ້ມຂອງຂ້ອຍ** | ຄັ້ງທຳອິດ: ຕື່ມຂໍ້ມູນໜ້າປົກ (ຊື່, ວັນເກີດ ຕ້ອງໃສ່) → **ສ້າງປຶ້ມ ແລະ ລົງທະບຽນ** → Confirm. ລະບົບອອກເລກປຶ້ມ `MC-ປີ-xxxxxx` — ເອົາເລກນີ້ໃຫ້ທ່ານໝໍ. ຫຼັງຈາກນັ້ນເຫັນປະຫວັດການກວດທັງໝົດ. |
| **ສິດການເຂົ້າເຖິງ** | ຊອກຊື່ທ່ານໝໍ/ໂຮງໝໍ → ເລືອກ → ໝາຍປະເພດຂໍ້ມູນ (ການກວດ ແລະ ຢາ / ສັນຍານຊີບ / ຜົນກວດ) → ວັນໝົດອາຍຸ → **ເປີດສິດ**. ກົດ **ຖອນສິດ** ເພື່ອປິດທັນທີ. |
| **ປະຫວັດການເຂົ້າເຖິງ** | ໃຜເບິ່ງ, ເພີ່ມ, ຖືກປະຕິເສດ, ເປີດ/ຖອນສິດ ເມື່ອໃດ (⛓ = ບັນທຶກເທິງ Blockchain). |
| **ກວດສອບເອກະສານ** | ເບິ່ງຫົວຂໍ້ "ກວດສອບເອກະສານ" ທາງລຸ່ມ. |

### ແພດ ແລະ ພະຍາບານ
1. ແຖບ **ປຶ້ມຄົນເຈັບ** → ໃສ່ເລກປຶ້ມທີ່ຄົນເຈັບໃຫ້ → **ເປີດປຶ້ມ**.
   ຖ້າຂຶ້ນ "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງປຶ້ມນີ້" — ໃຫ້ຄົນເຈັບເປີດສິດກ່ອນ.
2. ແຖບສີຟ້າ "ສິດຂອງທ່ານໃນປຶ້ມນີ້" ບອກວ່າເບິ່ງ/ບັນທຶກປະເພດໃດໄດ້.
3. ເລືອກປະເພດ → ຕື່ມຂໍ້ມູນ → **ບັນທຶກ ແລະ ລົງນາມ** → Confirm. ບັນທຶກຈະໄດ້ຕາປະທັບແດງ **ຢືນຢັນເທິງ Blockchain**.
   - ແພດ: ການກວດ (ອາການ, PE, Dx, ຢາ ແຖວລະລາຍການ, ແຜນ, ນັດກວດຄືນ), ສັນຍານຊີບ, ຜົນກວດ (`HGB: 14.3` ແຖວລະລາຍການ).
   - ພະຍາບານ: ສັນຍານຊີບເທົ່ານັ້ນ.
4. ຖ້າກົດ Reject ໃນ MetaMask, ບັນທຶກຍັງຢູ່ແຕ່ຂຶ້ນ **ຍັງບໍ່ຢືນຢັນ** → ກົດ **ລົງນາມຢືນຢັນ** ເພື່ອລອງໃໝ່.
5. **ແກ້ໄຂ**: ກົດ "ແກ້ໄຂ" ໃຕ້ບັນທຶກ → ປ່ຽນ → ບັນທຶກ. ສະບັບເກົ່າຍັງເກັບໄວ້ໃນ "ສະບັບກ່ອນແກ້ໄຂ" — ບໍ່ມີການລຶບ.

### Admin (ບັນຊີ #0)
- **ເພີ່ມໂຮງໝໍ**: ໃສ່ຊື່ ແລະ ແຂວງ → **ເພີ່ມໂຮງໝໍ**.
- **ເພີ່ມບຸກຄະລາກອນ**: ໃສ່ Wallet address, ບົດບາດ, ຊື່, ຕຳແໜ່ງ, ໂຮງໝໍ → **ເພີ່ມບຸກຄະລາກອນ** → Confirm.
- **ແກ້ໄຂ**: ຊອກຊື່ໃນລາຍຊື່ → ກົດ → ແກ້ → ບັນທຶກ. ປ່ຽນແຕ່ຊື່/ໂຮງໝໍ ບໍ່ຕ້ອງ Confirm; ປ່ຽນບົດບາດຕ້ອງ Confirm.
- **ຖອນບົດບາດ**: ເລືອກຄົນ → **ຖອນບົດບາດ** — ຜູ້ນັ້ນຈະເສຍສິດເຂົ້າເຖິງທຸກປຶ້ມທັນທີ.

### ກວດສອບເອກະສານ
1. ໃນປຶ້ມ ກົດ **ດາວໂຫຼດເອກະສານ** ໃຕ້ບັນທຶກ (ໄດ້ໄຟລ໌ `.json`).
2. ແຖບ **ກວດສອບເອກະສານ** → ເລືອກໄຟລ໌ (ຫຼື ວາງເນື້ອຫາ / hash `0x…`) → **ກວດສອບ**.
3. **ເອກະສານກົງກັນ** = ບໍ່ຖືກແກ້ໄຂ, ສະແດງຜູ້ບັນທຶກ ແລະ ເວລາ. **ບໍ່ພົບ Hash ນີ້** = ເອກະສານຖືກປ່ຽນ ຫຼື ບໍ່ໄດ້ມາຈາກລະບົບ.

### ແກ້ບັນຫາ
| ອາການ | ວິທີແກ້ |
|---|---|
| "ບໍ່ພົບ MetaMask" | ຕິດຕັ້ງ extension ແລ້ວໂຫຼດໜ້າຄືນ. ໃນມືຖືໃຫ້ເປີດເວັບຜ່ານ browser ໃນແອັບ MetaMask. |
| ແຖບແດງ "Network ຜິດ" | ກົດ **ສະຫຼັບ Network**. ລະບົບຈະບໍ່ສົ່ງທຸລະກຳໃນ Network ອື່ນ. |
| MetaMask ສະແດງ "Network fee" ສີແດງ / ກົດ Confirm ບໍ່ໄດ້ | Wallet ບໍ່ມີ ETH ທົດລອງ — ໃຊ້ບັນຊີ #0–#5 ຫຼື ຂໍໃຫ້ຜູ້ດູແລເຕີມ. |
| ທຸລະກຳຄ້າງ / nonce ຜິດ ຫຼັງ reset chain | MetaMask → Settings → Advanced → **Clear activity tab data**. |
| "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງປຶ້ມນີ້" | ຄົນເຈັບຍັງບໍ່ເປີດສິດ, ສິດໝົດອາຍຸ ຫຼື ຖືກຖອນແລ້ວ. |
| "ໝົດເວລາເຂົ້າສູ່ລະບົບ" | ກົດ ຕັດການເຊື່ອມຕໍ່ ແລ້ວເຊື່ອມຕໍ່ໃໝ່ (session ໃຊ້ໄດ້ 8 ຊົ່ວໂມງ). |

## Deploy ຂຶ້ນ Server (POC)

ຕ້ອງການ Ubuntu + Docker. Code ຢູ່ `~/medichain`, ເປີດຜ່ານ Cloudflare Tunnel → `http://localhost:80`.

```bash
cd ~/medichain && ./deploy/deploy.sh
```

- ຄັ້ງທຳອິດສ້າງ `.env.prod` (ລະຫັດ DB, `DATA_KEY`, `SESSION_SECRET`) — **ສຳຮອງໄວ້**, ເສຍ `DATA_KEY` = ອ່ານບັນທຶກບໍ່ໄດ້.
- Deploy contract ຄັ້ງດຽວ; ແລ່ນຊ້ຳເພື່ອອັບເດດ code ໂດຍຂໍ້ມູນຍັງຢູ່.
- Chain ແມ່ນ Anvil (ບັນທຶກ state ລົງ disk), Chain ID `31337`, RPC ທີ່ `/rpc`.

## ຂໍ້ຈຳກັດຂອງ Prototype

- Key ເຂົ້າລະຫັດມີອັນດຽວຢູ່ server (`DATA_KEY`) — Production ຄວນໃຊ້ KMS / key ຕໍ່ຄົນເຈັບ.
- Sign-in nonce ເກັບໃນ memory ຂອງ process ດຽວ.
- ຖອນສິດປິດການເຂົ້າເຖິງຜ່ານແອັບ, ແຕ່ລຶບສຳເນົາທີ່ດາວໂຫຼດໄປແລ້ວບໍ່ໄດ້.
