// Demo: tạo token, mua ngay lúc đầu (bị phí chống bot cao), chờ rồi mua lại (phí thấp hơn), bán 1 nửa.
// Dùng để quay video và lấy mã giao dịch cho báo cáo check-in.
// Chạy: npm run demo:local   hoặc   npm run demo:testnet   (phải deploy trước)
const { ethers, network } = require("hardhat"); // Lấy ethers và thông tin mạng
const fs = require("fs"); // Thư viện đọc ghi file
const path = require("path"); // Thư viện ghép đường dẫn

const BUY_AMOUNT = ethers.parseEther(process.env.DEMO_BUY_AMOUNT || "0.01"); // Số tiền mỗi lệnh mua demo, mặc định 0.01
const WAIT_SECONDS = Number(process.env.DEMO_WAIT_SECONDS || "60"); // Số giây chờ giữa 2 lệnh mua để thấy phí giảm

function sleep(ms) { // Hàm chờ
  return new Promise((resolve) => setTimeout(resolve, ms)); // Trả về lời hứa hoàn thành sau ms mili giây
}

async function main() { // Hàm chính
  const file = path.join(__dirname, "..", "deployments", `${network.name}-launchpad.json`); // File địa chỉ Launchpad đã deploy
  if (!fs.existsSync(file)) { // Chưa deploy
    console.log("CHUA DEPLOY: chay npm run deploy:local (hoac deploy:testnet) truoc."); // Báo thiếu điều kiện tiên quyết
    process.exit(1); // Dừng
  }
  const { address } = JSON.parse(fs.readFileSync(file, "utf8")); // Đọc địa chỉ Launchpad
  const [user] = await ethers.getSigners(); // Ví dùng để demo
  const launchpad = await ethers.getContractAt("Launchpad", address, user); // Kết nối tới contract đã deploy
  const log = {}; // Nơi ghi lại mã giao dịch

  const createTx = await launchpad.createToken("Fair Demo", "FAIR", 100); // Tạo token, phí người tạo 1% (100 bps)
  await createTx.wait(); // Chờ xác nhận
  log.createTxHash = createTx.hash; // Lưu mã giao dịch
  const tokenAddress = await launchpad.allTokens((await launchpad.tokenCount()) - 1n); // Địa chỉ token vừa tạo là phần tử cuối danh sách
  log.tokenAddress = tokenAddress; // Lưu địa chỉ token
  console.log("Token created:", tokenAddress, "tx:", createTx.hash); // In kết quả

  const snipeBps1 = await launchpad.currentSnipeFeeBps(tokenAddress); // Phí chống bot ngay lúc này
  console.log(`\nMua NGAY lap tuc: phi chong bot hien tai = ${Number(snipeBps1) / 100}%`); // In phí
  const buy1 = await launchpad.buy(tokenAddress, 0, { value: BUY_AMOUNT }); // Mua lần 1, minTokensOut = 0 vì đây là demo
  const receipt1 = await buy1.wait(); // Chờ xác nhận
  log.buyEarlyTxHash = buy1.hash; // Lưu mã giao dịch
  console.log("  tx:", buy1.hash, "gas used:", receipt1.gasUsed.toString()); // In mã và gas

  console.log(`\nCho ${WAIT_SECONDS} giay de phi chong bot giam...`); // Thông báo chờ
  if (network.name === "hardhat" || network.name === "localhost") { // Mạng ảo thì tua thời gian được
    await ethers.provider.send("evm_increaseTime", [WAIT_SECONDS]); // Tua thời gian của mạng ảo
    await ethers.provider.send("evm_mine", []); // Đào 1 block để thời gian mới có hiệu lực
  } else { // Mạng thật thì phải chờ thật
    await sleep(WAIT_SECONDS * 1000); // Chờ đúng số giây
  }

  const snipeBps2 = await launchpad.currentSnipeFeeBps(tokenAddress); // Phí chống bot sau khi chờ
  console.log(`Mua SAU KHI CHO: phi chong bot hien tai = ${Number(snipeBps2) / 100}%`); // In phí
  const buy2 = await launchpad.buy(tokenAddress, 0, { value: BUY_AMOUNT }); // Mua lần 2 cùng số tiền
  await buy2.wait(); // Chờ xác nhận
  log.buyLaterTxHash = buy2.hash; // Lưu mã giao dịch
  console.log("  tx:", buy2.hash); // In mã giao dịch

  const token = await ethers.getContractAt("LaunchToken", tokenAddress, user); // Kết nối tới token vừa tạo
  const balance = await token.balanceOf(user.address); // Số token đang có
  const sellAmount = balance / 2n; // Bán một nửa
  const approveTx = await token.approve(address, sellAmount); // BƯỚC TIÊN QUYẾT: cho phép Launchpad lấy token của mình
  await approveTx.wait(); // Chờ xác nhận approve xong rồi mới bán
  log.approveTxHash = approveTx.hash; // Lưu mã giao dịch approve
  const sellTx = await launchpad.sell(tokenAddress, sellAmount, 0); // Bán, minNativeOut = 0 vì đây là demo
  await sellTx.wait(); // Chờ xác nhận
  log.sellTxHash = sellTx.hash; // Lưu mã giao dịch bán
  console.log("\nSold half of tokens. tx:", sellTx.hash); // In kết quả

  const outDir = path.join(__dirname, "..", "deployments"); // Thư mục lưu kết quả
  fs.writeFileSync(path.join(outDir, `${network.name}-demo-trade.json`), JSON.stringify(log, null, 2)); // Ghi mã giao dịch ra file để đưa vào báo cáo
  console.log("\nDa luu ma giao dich vao deployments/. Dung chung cho README va bao cao check-in."); // Báo xong
}

main().catch((error) => { // Nếu có lỗi
  console.error(error); // In lỗi
  process.exit(1); // Dừng với mã lỗi
});
