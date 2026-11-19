// AgentWall — frontend statis, tanpa build step, tanpa server.
// Semua baca/tulis lewat RPC publik BSC + dompet injected (window.ethereum).
// TIDAK pakai WalletConnect, TIDAK minta QR/pairing code, TIDAK simpan sesi.
"use strict";

// >>> ISI SETELAH DEPLOY: alamat kontrak AgentWall di BSC mainnet. <<<
const CONTRACT_ADDRESS = "0x24407103807bd686a4da59cd262a109090527e3e"; // deploy 19 Nov 2026 (BSC mainnet)
const AGENT_ID_ADDRESS = "0x60b9262456de011f7d15a54cdd8c48baaa8b022f"; // SPACE ID Agent ID (ERC-721)
const BSC_CHAIN_ID = 56;
const BSC_RPC = "https://bsc-dataseed.binance.org";

const AGENT_ID_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const WALL_ABI = [
  "function sign(string calldata message)",
  "function checkIn()",
  "function getSignature(address user) view returns (string message, uint256 timestamp)",
  "function totalSignatures() view returns (uint256)",
  "function getStreak(address user) view returns (uint256)",
  "function hasCheckedInToday(address user) view returns (bool)",
  "function totalCheckIns() view returns (uint256)",
  "event Signed(address indexed signer, string message, uint256 timestamp)",
  "event CheckedIn(address indexed user, uint256 streak, uint256 day)",
];

const $ = (id) => document.getElementById(id);
const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
const setStatus = (t) => { $("status").textContent = t || ""; };

const readProvider = new ethers.JsonRpcProvider(BSC_RPC);
const agentIdRead = new ethers.Contract(AGENT_ID_ADDRESS, AGENT_ID_ABI, readProvider);
const wallRead = CONTRACT_ADDRESS
  ? new ethers.Contract(CONTRACT_ADDRESS, WALL_ABI, readProvider)
  : null;

let signer = null;
let userAddr = null;
let wallWrite = null;

async function hasAgentId(addr) {
  try {
    const bal = await agentIdRead.balanceOf(addr);
    return bal > 0n;
  } catch (e) {
    console.error("balanceOf gagal:", e);
    return null; // tidak diketahui (RPC error), bukan "tidak punya"
  }
}

async function refreshPublic() {
  if (!wallRead) {
    $("totalSig").textContent = "—";
    $("totalCheckIn").textContent = "—";
    $("sigList").innerHTML =
      '<li class="muted">Kontrak belum di-deploy — isi CONTRACT_ADDRESS di app.js setelah deploy.</li>';
    return;
  }
  try {
    const [total, totalCI] = await Promise.all([
      wallRead.totalSignatures(),
      wallRead.totalCheckIns(),
    ]);
    $("totalSig").textContent = total.toString();
    $("totalCheckIn").textContent = totalCI.toString();
  } catch (e) {
    console.error("baca total gagal:", e);
  }
  await loadRecentSignatures();
}

async function loadRecentSignatures() {
  const list = $("sigList");
  try {
    const latest = await readProvider.getBlockNumber();
    const fromBlock = Math.max(0, latest - 20000); // ~17 jam terakhir (BSC ~3 dtk/blok)
    const CHUNK = 5000; // RPC publik membatasi range getLogs
    let events = [];
    for (let from = fromBlock; from <= latest; from += CHUNK) {
      const to = Math.min(latest, from + CHUNK - 1);
      const chunk = await wallRead.queryFilter(wallRead.filters.Signed(), from, to);
      events = events.concat(chunk);
    }
    events.sort((a, b) => b.blockNumber - a.blockNumber || b.index - a.index);
    events = events.slice(0, 20);
    if (!events.length) {
      list.innerHTML = '<li class="muted">Belum ada tanda tangan dalam ~17 jam terakhir.</li>';
      return;
    }
    list.innerHTML = events
      .map((ev) => {
        const when = new Date(Number(ev.args.timestamp) * 1000).toLocaleString("id-ID");
        const msg = ev.args.message
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<li><div>${msg}</div><div class="addr">${short(ev.args.signer)}</div><div class="time">${when}</div></li>`;
      })
      .join("");
  } catch (e) {
    console.error("baca event gagal:", e);
    list.innerHTML = '<li class="muted">Gagal memuat tanda tangan (RPC sibuk — coba refresh).</li>';
  }
}

async function refreshUser() {
  if (!userAddr || !wallRead) return;
  const agent = await hasAgentId(userAddr);
  $("agentIdStatus").innerHTML =
    agent === null
      ? 'Status Agent ID: <span class="no">tidak bisa dicek (RPC error)</span>'
      : agent
        ? 'Status Agent ID: <span class="ok">PUNYA ✓ — kamu bisa sign &amp; check-in</span>'
        : 'Status Agent ID: <span class="no">TIDAK PUNYA — klaim dulu di Binance App (Wallet &gt; banner Agent ID)</span>';
  const canWrite = agent === true;
  $("btnSign").disabled = !canWrite;
  $("btnCheckIn").disabled = !canWrite;
  try {
    const [msg, ts] = await wallRead.getSignature(userAddr);
    $("mySig").innerHTML = msg
      ? `Pesanmu saat ini: “${msg.replace(/</g, "&lt;")}” <span class="muted">(${new Date(Number(ts) * 1000).toLocaleString("id-ID")})</span>`
      : "Kamu belum menandatangani guestbook.";
    const [streak, doneToday] = await Promise.all([
      wallRead.getStreak(userAddr),
      wallRead.hasCheckedInToday(userAddr),
    ]);
    $("streakVal").textContent = streak.toString();
    $("checkInState").textContent = doneToday ? "Sudah check-in hari ini ✓" : "Belum check-in hari ini";
    if (doneToday) $("btnCheckIn").disabled = true;
  } catch (e) {
    console.error("baca data user gagal:", e);
  }
}

async function connect() {
  if (!window.ethereum) {
    setStatus("Dompet tidak ditemukan. Buka halaman ini di Binance Web3 Wallet / browser dengan MetaMask.");
    return;
  }
  try {
    setStatus("Menghubungkan dompet…");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== BSC_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }], // 56 = BSC mainnet
        });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x38", chainName: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: ["https://bsc-dataseed.binance.org"],
              blockExplorerUrls: ["https://bscscan.com"],
            }],
          });
        } else {
          throw switchErr;
        }
      }
    }
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddr = await signer.getAddress();
    wallWrite = CONTRACT_ADDRESS ? new ethers.Contract(CONTRACT_ADDRESS, WALL_ABI, signer) : null;
    $("walletAddr").textContent = short(userAddr);
    $("btnConnect").textContent = "Terhubung ✓";
    setStatus(CONTRACT_ADDRESS ? "" : "Dompet terhubung. Kontrak AgentWall belum di-deploy — tombol tulis/check-in aktif setelah CONTRACT_ADDRESS diisi.");
    await refreshUser();
  } catch (e) {
    console.error(e);
    setStatus("Gagal menghubungkan dompet: " + (e?.info?.error?.message || e?.message || e));
  }
}

async function doSign() {
  const message = $("msgInput").value.trim();
  if (!message) return setStatus("Tulis dulu pesanmu.");
  if (!wallWrite) return setStatus("Kontrak belum di-deploy.");
  try {
    setStatus("Kirim sign… (konfirmasi di dompetmu)");
    const tx = await wallWrite.sign(message);
    setStatus("Transaksi dikirim: " + tx.hash + " — menunggu konfirmasi…");
    await tx.wait();
    setStatus("✓ Tanda tangan tercatat on-chain!");
    $("msgInput").value = "";
    $("charCount").textContent = "0 / 280";
    await refreshUser();
    await refreshPublic();
  } catch (e) {
    console.error(e);
    setStatus("Sign gagal/dibatalkan: " + (e?.info?.error?.message || e?.reason || e?.message || e));
  }
}

async function doCheckIn() {
  if (!wallWrite) return setStatus("Kontrak belum di-deploy.");
  try {
    setStatus("Kirim check-in… (konfirmasi di dompetmu)");
    const tx = await wallWrite.checkIn();
    setStatus("Transaksi dikirim: " + tx.hash + " — menunggu konfirmasi…");
    const receipt = await tx.wait();
    setStatus("✓ Check-in tercatat on-chain!");
    await refreshUser();
    await refreshPublic();
    return receipt;
  } catch (e) {
    console.error(e);
    setStatus("Check-in gagal/dibatalkan: " + (e?.info?.error?.message || e?.reason || e?.message || e));
  }
}

$("btnConnect").addEventListener("click", connect);
$("btnSign").addEventListener("click", doSign);
$("btnCheckIn").addEventListener("click", doCheckIn);
$("msgInput").addEventListener("input", (e) => {
  $("charCount").textContent = `${e.target.value.length} / 280`;
});
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}

refreshPublic();
