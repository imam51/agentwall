# AgentWall — Guestbook + Check-in Harian untuk Pemegang Agent ID

Proyek untuk **Binance Agent ID Hackathon 2026** (total hadiah 60.000 USDC,
submit 18 Nov–9 Des 2026 15:00 WIB). Satu-satunya gate: pemegang Agent ID
(Binance Agentic Wallet). Tanpa owner, tanpa upgradeability, tanpa fee,
tanpa fungsi admin — sesuai red line hackathon.

## Kontrak: `contracts/AgentWall.sol`

- Solidity ^0.8.20, alamat Agent ID di-pass lewat constructor sebagai
  `immutable` (tidak ada setter/admin setelah deploy).
- Kontrak Agent ID resmi (BSC, ERC-721, non-transferable):
  `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`
  — terverifikasi via `eth_call`: `name()` = "SPACE ID Agent ID",
  `symbol()` = "AI", `balanceOf(<wallet contoh>)` = 1.
- `sign(string message)` — 1 slot per alamat (boleh update pesan, tetap
  1 slot). Maks 280 karakter. Emit `Signed`.
- `checkIn()` — 1x per hari per alamat (hari = `block.timestamp / 1 days`).
  Streak +1 kalau kemarin check-in, reset ke 1 kalau bolong. Emit `CheckedIn`.
- View: `getSignature(address)`, `totalSignatures()`, `getStreak(address)`,
  `hasCheckedInToday(address)`, `totalCheckIns()`.
- Revert message jelas: `AgentWall: need Agent ID`,
  `AgentWall: already checked in today`, `AgentWall: message too long`,
  `AgentWall: empty message`.

## Test

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge test
```

14/14 lolos (19 Nov 2026, forge 1.9.0), mencakup: non-holder ditolak di
`sign` dan `checkIn`; holder bisa sign + update (slot tetap 1); pesan kosong
dan >280 karakter ditolak; pesan persis 280 karakter lolos; check-in 2x
sehari ditolak; streak 2 hari berturut-turut; streak reset kalau bolong;
event `Signed`/`CheckedIn` ter-emit; `sign` tidak memengaruhi streak.

## Estimasi gas (diukur nyata di anvil lokal, 19 Nov 2026)

Gas price BSC saat ini: **0,05 gwei** (terverifikasi `eth_gasPrice` =
50.000.000 wei). Bytecode: runtime 3.035 byte, init 3.181 byte.

| Aksi | Gas | Biaya @ 0,05 gwei |
| --- | --- | --- |
| Deploy | 710.732 | **0,00003554 BNB** (~$0,021 @ BNB $586) |
| `sign` (pertama) | 119.695 | 0,00000598 BNB (~$0,0035) |
| `checkIn` | 95.337 | 0,00000477 BNB (~$0,0028) |

## Deploy

**SUDAH DEPLOY 19 Nov 2026** ke BSC mainnet oleh deployer
`0x0760F0556A5D436C372Ee2FAAc32ea8Bcef7F345` (Binance Web3 Wallet,
one-tap deploy page). **Alamat kontrak:
`0x24407103807bd686a4da59cd262a109090527e3e`.**
Constructor arg: alamat Agent ID resmi
`0x60b9262456de011f7d15a54cdd8c48baaa8b022f` (terverifikasi on-chain:
`agentId()` mengembalikan alamat itu; `totalSignatures()` = 0 saat deploy).

## Verifikasi source

**Terverifikasi di Sourcify 19 Nov 2026 — exact_match** (creation + runtime),
verifiedAt 2026-11-19T08:37:48Z. Source publik dan reproducible.

```bash
forge verify-contract 0x24407103807bd686a4da59cd262a109090527e3e \
  contracts/AgentWall.sol:AgentWall --chain-id 56 \
  --rpc-url https://bsc-dataseed1.bnbchain.org --verifier sourcify \
  --compiler-version 0.8.20 \
  --constructor-args 0x00000000000000000000000060b9262456de011f7d15a54cdd8c48baaa8b022f
```

Verifikasi native di BscScan (Verify & Publish → Solidity 0.8.20,
optimizer ON runs 200, paste source + constructor arg di atas) masih
pending — BscScan memblokir akses otomatis dengan Cloudflare.

## Frontend (`frontend/`)

Statis, tanpa build step. Buka `index.html` langsung atau serve statis apa pun:

```bash
cd frontend && python3 -m http.server 8000
# buka http://localhost:8000
```

- `ethers` v6 via CDN (jsDelivr). Connect via `window.ethereum` injected
  (Binance Web3 Wallet / MetaMask). Tanpa WalletConnect, tanpa QR,
  tanpa pairing code, tanpa server/sesi.
- Cek status Agent ID via `balanceOf` (RPC publik BSC). Form sign (maks
  280 karakter), tombol check-in + streak, daftar tanda tangan terbaru
  dari event `Signed` (20.000 blok terakhir, chunk 5.000 blok).
- `CONTRACT_ADDRESS` di `app.js` sudah diisi:
  `0x24407103807bd686a4da59cd262a109090527e3e`.
- Hosting: GitHub Pages — https://imam51.github.io/agentwall/

## Status sebelum submit hackathon

- [x] Deploy ke BSC mainnet (19 Nov 2026).
- [x] Verifikasi source di Sourcify (exact_match).
- [x] `CONTRACT_ADDRESS` di `frontend/app.js` terisi + hosting statis.
- [x] Repo publik GitHub ini berisi kontrak + frontend + README.
- [ ] **Isi form submit proyek hackathon** (pengumuman Binance tidak
  mencantumkan link form — cek di Binance App / halaman hackathon).
- [ ] **30 alamat Agent ID berinteraksi** selama periode submit (syarat
  Innovation Award) — promosikan ke komunitas Agent ID; pemegang
  Agent ID bisa sign + check-in harian.

## Keamanan

- Tidak ada private key / seed phrase di repo ini, dan tidak boleh ada.
- Tidak ada fungsi yang memindahkan dana user; kontrak tidak memegang BNB.
- Alamat wallet user tidak di-hardcode di kode (hanya dipakai sebagai
  contoh verifikasi di README ini saat penulisan, bukan di source).
