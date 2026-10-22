require("@nomicfoundation/hardhat-toolbox"); // Nạp bộ công cụ chuẩn của Hardhat (ethers, chai, test helpers)
require("dotenv").config(); // Đọc file .env để lấy khóa ví và địa chỉ RPC, không ghi cứng vào code

const portaldotRpcUrl = process.env.PORTALDOT_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev"; // Địa chỉ RPC testnet Portaldot, lấy từ trang hackathon ngày 20/10, cần kiểm tra lại
const deployerPrivateKey = process.env.PRIVATE_KEY; // Khóa riêng của ví thử nghiệm, chỉ nằm trong .env

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { // Cài đặt trình biên dịch Solidity
    version: "0.8.28", // Phiên bản trình biên dịch
    settings: { // Tùy chọn biên dịch
      optimizer: { enabled: true, runs: 200 }, // Bật tối ưu hóa để contract nhỏ và rẻ gas hơn
      evmVersion: "paris", // Dùng bộ lệnh EVM cũ hơn để tránh lệnh PUSH0, vì chưa chắc Portaldot hỗ trợ lệnh mới
    },
  },
  networks: { // Các mạng có thể deploy
    portaldotTestnet: { // Testnet Portaldot V3
      url: portaldotRpcUrl, // Địa chỉ RPC
      chainId: 420420777, // Chain ID của testnet, lấy từ trang hackathon ngày 20/10
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [], // Có khóa thì dùng, không có thì để trống để báo lỗi rõ ràng
    },
  },
};
