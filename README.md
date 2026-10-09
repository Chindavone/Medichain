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

## MetaMask

1. ເພີ່ມ Network: RPC `http://127.0.0.1:8545`, Chain ID `31337`, Symbol `ETH`.
2. Import private key ຂອງ Hardhat test accounts (ສະແດງຕອນ `npm run chain`):

| Account | ບົດບາດ |
|---|---|
| #0 | Admin / Contract owner |
| #1, #2 | ແພດ |
| #3 | ພະຍາບານ |
| #4, #5 | ຄົນເຈັບ (ສ້າງປຶ້ມເອງໃນແອັບ) |

3. ຫຼັງ restart node ໃຫ້ກົດ *Settings → Advanced → Clear activity tab data* ໃນ MetaMask (nonce ເກົ່າ).

> Hardhat private keys ແມ່ນສາທາລະນະ — ໃຊ້ສະເພາະທົດລອງ, ຫ້າມໃຊ້ກັບກະເປົາຈິງ ຫຼື ຂໍ້ມູນຄົນເຈັບຈິງ.

## Flow ທົດສອບ

1. Account #4 → ສ້າງປຶ້ມ → ລົງທະບຽນເທິງ Blockchain.
2. ແຖບ *ສິດການເຂົ້າເຖິງ* → ເປີດສິດໃຫ້ແພດ #1 (ເລືອກປະເພດຂໍ້ມູນ + ວັນໝົດອາຍຸ).
3. Account #1 → ໃສ່ເລກປຶ້ມ → ບັນທຶກການກວດ → ລົງນາມ hash (ຕາປະທັບສີແດງ).
4. ກັບໄປ #4 → ຖອນສິດ → #1 ເປີດປຶ້ມອີກ ຈະຖືກປະຕິເສດ.
5. Account #0 (Admin) → ແຖບ *ບຸກຄະລາກອນ* → ເພີ່ມໂຮງໝໍ, ກຳນົດໂຮງໝໍໃຫ້ທ່ານໝໍ, ຊອກ/ກັ່ນຕອງຕາມຊື່ ແລະ ໂຮງໝໍ.
6. *ກວດສອບເອກະສານ* → ເລືອກໄຟລ໌ທີ່ດາວໂຫຼດ → ກົງກັນ / ບໍ່ພົບ hash.

## ຂໍ້ຈຳກັດຂອງ Prototype

- Key ເຂົ້າລະຫັດມີອັນດຽວຢູ່ server (`DATA_KEY`) — Production ຄວນໃຊ້ KMS / key ຕໍ່ຄົນເຈັບ.
- Sign-in nonce ເກັບໃນ memory ຂອງ process ດຽວ.
- ຖອນສິດປິດການເຂົ້າເຖິງຜ່ານແອັບ, ແຕ່ລຶບສຳເນົາທີ່ດາວໂຫຼດໄປແລ້ວບໍ່ໄດ້.
