import { createConfig, http } from "wagmi"; // Hàm tạo cấu hình wagmi và hàm kết nối RPC
import { injected } from "wagmi/connectors"; // Kết nối ví cài sẵn trong trình duyệt (MetaMask)
import { defineChain } from "viem"; // Hàm khai báo một mạng EVM

export const localChain = defineChain({ // Mạng ảo Hardhat chạy trên máy
  id: 31337, // Chain ID mặc định của Hardhat
  name: "Hardhat Local", // Tên hiện cho người dùng
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, // Tiền gốc của mạng ảo
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } }, // Địa chỉ RPC của npm run node
});

export const portaldotChain = defineChain({ // Testnet Portaldot V3
  id: 420420777, // Chain ID lấy từ thông báo ban tổ chức
  name: "Portaldot V3 Testnet", // Tên hiện cho người dùng
  nativeCurrency: { name: "POT", symbol: "POT", decimals: 18 }, // Giả định 18 chữ số thập phân, chưa xác minh ở lớp EVM
  rpcUrls: { default: { http: ["https://test-evm-rpc-v3.portaldot.dev"] } }, // RPC chính thức
});

export const targetChain = process.env.NEXT_PUBLIC_NETWORK === "testnet" ? portaldotChain : localChain; // Chọn mạng theo biến môi trường, mặc định là mạng ảo
export const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS; // Địa chỉ contract đã deploy, lấy từ deployments/
export const explorerTxUrl = process.env.NEXT_PUBLIC_EXPLORER_TX_URL; // Tiền tố link xem giao dịch (có thể để trống)

export const wagmiConfig = createConfig({ // Cấu hình chung cho cả app
  chains: [targetChain], // Chỉ hỗ trợ một mạng đích
  connectors: [injected()], // Chỉ kết nối qua ví trong trình duyệt
  transports: { [targetChain.id]: http() }, // Đọc dữ liệu qua RPC mặc định của mạng đích
  ssr: true, // Cho phép render phía server của Next.js
});
