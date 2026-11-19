// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentWall — guestbook + check-in harian, khusus pemegang Agent ID
/// @notice Binance Agent ID Hackathon 2026. Kontrak ini TIDAK punya owner,
///         TIDAK bisa di-upgrade, TIDAK memungut fee, dan TIDAK punya fungsi
///         admin apa pun. Satu-satunya gate: balanceOf Agent ID > 0.
/// @dev Alamat kontrak Agent ID (SPACE ID, ERC-721, non-transferable, BNB Chain)
///      di-pass lewat constructor sebagai immutable, supaya kontrak tetap
///      testable dan tidak ada setter/admin setelah deploy.
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

contract AgentWall {
    /// @notice Kontrak Agent ID resmi Binance (BSC mainnet).
    IAgentID public immutable agentId;

    /// @notice Panjang pesan maksimum (karakter/byte).
    uint256 public constant MAX_MESSAGE_LEN = 280;

    struct Signature {
        string message;
        uint256 timestamp;
    }

    /// @notice 1 slot tanda tangan per alamat (bisa di-update, tetap 1 slot).
    mapping(address => Signature) public signatures;

    /// @notice Daftar alamat yang pernah menandatangani (untuk enumerasi).
    address[] public signers;

    /// @notice Hari terakhir check-in per alamat (hari = block.timestamp / 1 days).
    mapping(address => uint256) public lastCheckInDay;

    /// @notice Streak check-in berurutan per alamat.
    mapping(address => uint256) public streaks;

    /// @notice Total seluruh check-in dari semua alamat.
    uint256 public totalCheckIns;

    event Signed(address indexed signer, string message, uint256 timestamp);
    event CheckedIn(address indexed user, uint256 streak, uint256 day);

    constructor(address _agentId) {
        agentId = IAgentID(_agentId);
    }

    modifier onlyAgentIDHolder() {
        require(agentId.balanceOf(msg.sender) > 0, "AgentWall: need Agent ID");
        _;
    }

    /// @notice Tanda tangan guestbook. 1 slot per alamat; memanggil lagi
    ///         meng-update pesan yang sama (tidak menambah slot baru).
    function sign(string calldata message) external onlyAgentIDHolder {
        bytes memory m = bytes(message);
        require(m.length > 0, "AgentWall: empty message");
        require(m.length <= MAX_MESSAGE_LEN, "AgentWall: message too long");
        if (bytes(signatures[msg.sender].message).length == 0) {
            signers.push(msg.sender);
        }
        signatures[msg.sender] = Signature(message, block.timestamp);
        emit Signed(msg.sender, message, block.timestamp);
    }

    /// @notice Check-in harian. 1x per hari per alamat. Streak naik +1 kalau
    ///         kemarin juga check-in; kalau bolong, streak reset ke 1.
    function checkIn() external onlyAgentIDHolder {
        uint256 day = block.timestamp / 1 days;
        require(lastCheckInDay[msg.sender] != day, "AgentWall: already checked in today");
        uint256 streak = lastCheckInDay[msg.sender] == day - 1
            ? streaks[msg.sender] + 1
            : 1;
        streaks[msg.sender] = streak;
        lastCheckInDay[msg.sender] = day;
        totalCheckIns += 1;
        emit CheckedIn(msg.sender, streak, day);
    }

    /// @notice Tanda tangan + waktu tanda tangan suatu alamat.
    function getSignature(address user)
        external
        view
        returns (string memory message, uint256 timestamp)
    {
        Signature storage s = signatures[user];
        return (s.message, s.timestamp);
    }

    /// @notice Jumlah alamat unik yang pernah menandatangani.
    function totalSignatures() external view returns (uint256) {
        return signers.length;
    }

    /// @notice Streak check-in berurutan suatu alamat.
    function getStreak(address user) external view returns (uint256) {
        return streaks[user];
    }

    /// @notice Apakah alamat sudah check-in hari ini.
    function hasCheckedInToday(address user) external view returns (bool) {
        return lastCheckInDay[user] == block.timestamp / 1 days;
    }
}
