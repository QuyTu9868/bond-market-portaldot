// Deploy contract Launchpad. Chạy local trước, chỉ chạy testnet khi đã test xong.
// Chạy: npm run deploy:local   hoặc   npm run deploy:testnet
const { ethers, network } = require("hardhat"); // Lấy ethers và thông tin mạng từ Hardhat
const fs = require("fs"); // Thư viện đọc ghi file của Node
const path = require("path"); // Thư viện ghép đường dẫn của Node

async function main() { // Hàm chính
  const initialVirtualNative = ethers.parseEther(process.env.INITIAL_VIRTUAL_NATIVE || "0.3"); // Tiền ảo ban đầu, đọc từ .env, mặc định 0.3
  const graduationNative = ethers.parseEther(process.env.GRADUATION_NATIVE || "0.85"); // Mục tiêu tốt nghiệp, mặc định 0.85 (tỉ lệ giống 8.5 so với 3)

  const [deployer] = await ethers.getSigners(); // Lấy ví deploy
  if (!deployer) { // Nếu chưa có ví
    console.log("CHUA CO VI: dien PRIVATE_KEY vao .env truoc."); // Báo thiếu điều kiện tiên quyết
    process.exit(1); // Dừng
  }
  const balance = await ethers.provider.getBalance(deployer.address); // Kiểm tra số dư
  if (balance === 0n) { // Số dư bằng 0 thì không trả được phí
    console.log("SO DU BANG 0: chay 'npm run check:network' de xem nguyen nhan."); // Hướng dẫn kiểm tra
    process.exit(1); // Dừng
  }

  const Launchpad = await ethers.getContractFactory("Launchpad"); // Lấy bản thiết kế contract
  const launchpad = await Launchpad.deploy(initialVirtualNative, graduationNative); // Deploy với 2 tham số đường giá
  const deployTx = launchpad.deploymentTransaction(); // Lấy giao dịch deploy
  await launchpad.waitForDeployment(); // Chờ xác nhận
  const address = await launchpad.getAddress(); // Lấy địa chỉ contract
  const blockNumber = await ethers.provider.getBlockNumber(); // Block hiện tại, để ghi lại

  console.log("Launchpad deployed at:", address); // In địa chỉ
  console.log("Deploy tx hash       :", deployTx.hash); // In mã giao dịch

  const outDir = path.join(__dirname, "..", "deployments"); // Thư mục lưu kết quả
  fs.mkdirSync(outDir, { recursive: true }); // Tạo thư mục nếu chưa có
  fs.writeFileSync( // Ghi địa chỉ ra file để script demo và frontend dùng lại
    path.join(outDir, `${network.name}-launchpad.json`), // Tên file có kèm tên mạng
    JSON.stringify({ network: network.name, address, deployer: deployer.address, deployTxHash: deployTx.hash, blockNumber, initialVirtualNative: initialVirtualNative.toString(), graduationNative: graduationNative.toString() }, null, 2) // Nội dung
  ); // Kết thúc ghi file
}

main().catch((error) => { // Nếu có lỗi
  console.error(error); // In lỗi
  process.exit(1); // Dừng với mã lỗi
});
