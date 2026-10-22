// CHECKPOINT 0: kiểm tra mạng Portaldot chạy được Solidity thật TRƯỚC KHI viết gì thêm.
// Chạy: npm run check:network
const { ethers, network } = require("hardhat"); // Lấy ethers và thông tin mạng đang chạy từ Hardhat
const fs = require("fs"); // Thư viện đọc ghi file có sẵn của Node
const path = require("path"); // Thư viện ghép đường dẫn có sẵn của Node

async function main() { // Hàm chính, chạy bất đồng bộ vì gọi mạng
  const provider = ethers.provider; // Kết nối tới mạng đang chọn bằng --network
  const chain = await provider.getNetwork(); // Hỏi mạng: chain ID là gì
  const blockNumber = await provider.getBlockNumber(); // Hỏi mạng: block mới nhất là số mấy
  console.log("Network name :", network.name); // In tên mạng
  console.log("Chain ID     :", chain.chainId.toString()); // In chain ID, phải là 420420777 với testnet Portaldot
  console.log("Latest block :", blockNumber); // In số block, số này tăng dần nghĩa là mạng đang sống

  const signers = await ethers.getSigners(); // Lấy danh sách ví từ PRIVATE_KEY trong .env
  if (signers.length === 0) { // Nếu không có ví nào
    console.log("\nCHUA CO VI: hay dien PRIVATE_KEY vao file .env (xem .env.example)."); // Báo thiếu điều kiện tiên quyết
    process.exit(1); // Dừng chương trình với mã lỗi
  }
  const deployer = signers[0]; // Ví đầu tiên dùng để deploy
  const balance = await provider.getBalance(deployer.address); // Hỏi số dư của ví
  console.log("Deployer     :", deployer.address); // In địa chỉ ví EVM (dạng 0x...)
  console.log("Balance      :", ethers.formatEther(balance)); // In số dư theo đơn vị tiền gốc

  if (balance === 0n) { // Nếu số dư bằng 0 thì không trả được phí gas
    console.log("\nSO DU BANG 0. Co the token test dang nam o dia chi POT goc (bat dau bang so 5), chua o dia chi 0x."); // Giải thích nguyên nhân hay gặp
    console.log("Hoi admin Portaldot tren Discord cach chuyen/map token sang dia chi 0x cua ban."); // Hướng xử lý
    process.exit(1); // Dừng chương trình
  }

  const Ping = await ethers.getContractFactory("Ping"); // Lấy bản thiết kế contract Ping đã biên dịch
  const ping = await Ping.deploy(); // Gửi giao dịch deploy contract lên mạng
  const deployTx = ping.deploymentTransaction(); // Lấy giao dịch deploy để in mã hash
  await ping.waitForDeployment(); // Chờ mạng xác nhận deploy xong
  const pingAddress = await ping.getAddress(); // Lấy địa chỉ contract vừa deploy
  console.log("\nPing deployed at:", pingAddress); // In địa chỉ contract
  console.log("Deploy tx hash  :", deployTx.hash); // In mã giao dịch deploy

  const pingTx = await ping.ping(); // Gọi hàm ping() để chắc chắn ghi dữ liệu được
  await pingTx.wait(); // Chờ xác nhận
  console.log("Ping() tx hash  :", pingTx.hash); // In mã giao dịch ping
  console.log("pingCount       :", (await ping.pingCount()).toString()); // Đọc lại bộ đếm, phải bằng 1

  const outDir = path.join(__dirname, "..", "deployments"); // Thư mục lưu kết quả
  fs.mkdirSync(outDir, { recursive: true }); // Tạo thư mục nếu chưa có
  fs.writeFileSync( // Ghi kết quả ra file để dùng cho báo cáo check-in
    path.join(outDir, `${network.name}-checkpoint0-ping.json`), // Tên file có kèm tên mạng
    JSON.stringify({ chainId: chain.chainId.toString(), deployer: deployer.address, pingAddress, deployTxHash: deployTx.hash, pingTxHash: pingTx.hash }, null, 2) // Nội dung dạng JSON
  ); // Kết thúc ghi file
  console.log("\nCHECKPOINT 0 DAT: mang chay duoc Solidity. Ket qua da luu trong thu muc deployments/."); // Báo thành công
}

main().catch((error) => { // Nếu có lỗi bất kỳ
  console.error(error); // In lỗi ra màn hình
  process.exit(1); // Dừng với mã lỗi
});
