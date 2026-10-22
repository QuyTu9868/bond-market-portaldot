// Demo: tạo thị trường, cược Yes, đặt cọc Yes, chờ hết cửa sổ, chốt và nhận tiền.
// Dùng để quay video và lấy mã giao dịch cho báo cáo check-in. Chỉ cần 1 ví.
// Chạy: npm run demo:local   hoặc   npm run demo:testnet   (phải deploy trước)
const { ethers, network } = require("hardhat"); // Lấy ethers và thông tin mạng
const fs = require("fs"); // Thư viện đọc ghi file
const path = require("path"); // Thư viện ghép đường dẫn

const BET_AMOUNT = ethers.parseEther(process.env.DEMO_BET_AMOUNT || "0.01"); // Số tiền cược demo, mặc định 0.01
const BOND_AMOUNT = ethers.parseEther(process.env.DEMO_BOND_AMOUNT || "0.02"); // Số tiền cọc demo, mặc định 0.02
const BETTING_SECONDS = Number(process.env.DEMO_BETTING_SECONDS || "30"); // Thời gian cược của thị trường demo

function sleep(ms) { // Hàm chờ
  return new Promise((resolve) => setTimeout(resolve, ms)); // Trả về lời hứa hoàn thành sau ms mili giây
}

async function waitSeconds(seconds) { // Chờ một khoảng thời gian: tua trên mạng ảo, chờ thật trên mạng thật
  console.log(`Cho ${seconds} giay...`); // Thông báo chờ
  if (network.name === "hardhat" || network.name === "localhost") { // Mạng ảo thì tua thời gian được
    await ethers.provider.send("evm_increaseTime", [seconds]); // Tua thời gian của mạng ảo
    await ethers.provider.send("evm_mine", []); // Đào 1 block để thời gian mới có hiệu lực
  } else { // Mạng thật thì phải chờ thật
    await sleep((seconds + 5) * 1000); // Chờ thêm 5 giây cho chắc block mới đã qua mốc
  }
}

async function main() { // Hàm chính
  const file = path.join(__dirname, "..", "deployments", `${network.name}-market.json`); // File địa chỉ contract đã deploy
  if (!fs.existsSync(file)) { // Chưa deploy
    console.log("CHUA DEPLOY: chay npm run deploy:local (hoac deploy:testnet) truoc."); // Báo thiếu điều kiện tiên quyết
    process.exit(1); // Dừng
  }
  const { address, resolutionWindow } = JSON.parse(fs.readFileSync(file, "utf8")); // Đọc địa chỉ và độ dài cửa sổ
  const [user] = await ethers.getSigners(); // Ví dùng để demo
  const market = await ethers.getContractAt("PredictionMarket", address, user); // Kết nối tới contract đã deploy
  const log = {}; // Nơi ghi lại mã giao dịch

  const latest = await ethers.provider.getBlock("latest"); // Block mới nhất, lấy giờ của mạng
  const createTx = await market.createMarket("Demo: will this market resolve Yes?", latest.timestamp + BETTING_SECONDS); // Tạo thị trường
  await createTx.wait(); // Chờ xác nhận
  const id = (await market.marketCount()) - 1n; // Thị trường vừa tạo là phần tử cuối
  log.createTxHash = createTx.hash; // Lưu mã giao dịch
  console.log("Market created, id:", id.toString(), "tx:", createTx.hash); // In kết quả

  const betTx = await market.bet(id, true, { value: BET_AMOUNT }); // Cược Yes
  await betTx.wait(); // Chờ xác nhận
  log.betTxHash = betTx.hash; // Lưu mã giao dịch
  console.log("Bet Yes placed. tx:", betTx.hash); // In kết quả

  await waitSeconds(BETTING_SECONDS); // Chờ hết hạn cược

  const bondTx = await market.postBond(id, true, { value: BOND_AMOUNT }); // Đặt cọc cho Yes, mở cửa sổ phán quyết
  await bondTx.wait(); // Chờ xác nhận
  log.bondTxHash = bondTx.hash; // Lưu mã giao dịch
  console.log("Bond Yes posted. tx:", bondTx.hash); // In kết quả

  await waitSeconds(resolutionWindow); // Chờ hết cửa sổ phán quyết

  const previewBefore = await market.previewPayout(id, user.address); // Xem trước số tiền sẽ nhận
  console.log("Preview payout:", ethers.formatEther(previewBefore)); // In số xem trước
  const finalizeTx = await market.finalize(id); // Chốt kết quả
  await finalizeTx.wait(); // Chờ xác nhận
  log.finalizeTxHash = finalizeTx.hash; // Lưu mã giao dịch
  console.log("Finalized. tx:", finalizeTx.hash); // In kết quả

  const claimTx = await market.claim(id); // Nhận tiền
  await claimTx.wait(); // Chờ xác nhận
  log.claimTxHash = claimTx.hash; // Lưu mã giao dịch
  console.log("Claimed. tx:", claimTx.hash); // In kết quả

  const outDir = path.join(__dirname, "..", "deployments"); // Thư mục lưu kết quả
  fs.writeFileSync(path.join(outDir, `${network.name}-demo-market.json`), JSON.stringify(log, null, 2)); // Ghi mã giao dịch ra file để đưa vào báo cáo
  console.log("\nDa luu ma giao dich vao deployments/. Dung chung cho README va bao cao check-in."); // Báo xong
}

main().catch((error) => { // Nếu có lỗi
  console.error(error); // In lỗi
  process.exit(1); // Dừng với mã lỗi
});
