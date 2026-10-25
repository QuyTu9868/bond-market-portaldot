// Test E2E (bấm như người dùng thật) cho toàn luồng: kết nối ví, tạo thị trường, cược, cọc, chốt, nhận tiền.
// Điều kiện trước: terminal 1 chạy `npm run node`, terminal 2 chạy `npm run deploy:local` (ở thư mục gốc), terminal 3 chạy `npm run dev` (trong web/).
// Chạy: npm run test:e2e (trong web/). Dùng trình duyệt Edge cài sẵn trên Windows.
// Ví giả: window.ethereum chuyển mọi lệnh sang node Hardhat, dùng tài khoản mở sẵn của Hardhat (không cần MetaMask, không có khóa thật).
const { chromium } = require("playwright-core"); // Điều khiển trình duyệt
const { encodeFunctionData, parseAbi } = require("viem"); // Mã hóa lệnh gọi contract cho "người dùng khác"
const MARKET = process.env.MARKET_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Địa chỉ contract trên mạng ảo (lần deploy đầu tiên)

const APP = process.env.APP_URL || "http://localhost:3000"; // Địa chỉ app
const RPC = "http://127.0.0.1:8545"; // Mạng ảo Hardhat
const QUESTION = `E2E ${Date.now()}: will this pass?`; // Câu hỏi riêng cho mỗi lần chạy
const OTHER_QUESTION = `Other user market ${Date.now()}`; // Thị trường do "người khác" tạo, tên riêng cho mỗi lần chạy để tìm cho đúng

async function rpc(method, params) { // Gọi RPC của node Hardhat
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); // Gửi yêu cầu
  const json = await res.json(); // Đọc kết quả
  if (json.error) throw new Error(json.error.message); // Báo lỗi nếu có
  return json.result; // Trả kết quả
}

async function main() { // Hàm chính
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge" }); // Mở Edge (đổi sang "chrome" nếu cần)
  const page = await browser.newPage(); // Mở tab mới
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message)); // In lỗi JS của trang nếu có
  await page.exposeFunction("rpcCall", rpc); // Cầu nối từ trang sang node Hardhat
  await page.addInitScript(() => { // Giả lập ví MetaMask trước khi trang chạy
    window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, request: async ({ method, params }) => { // Nhận yêu cầu từ app
      if (method === "eth_requestAccounts") return window.rpcCall("eth_accounts", []); // Kết nối ví = lấy tài khoản mở sẵn
      return window.rpcCall(method, params || []); // Còn lại chuyển thẳng cho node
    } };
  });
  const step = (name) => console.log("OK:", name); // In bước đã qua

  await page.goto(APP); // Mở app
  await page.getByRole("button", { name: "Connect wallet" }).click(); // Kết nối ví
  await page.getByText("Create a market").waitFor(); step("connect wallet"); // Form tạo xuất hiện sau khi kết nối

  await page.fill("input[placeholder^='A Yes/No']", QUESTION); // Nhập câu hỏi
  await page.locator("label input").fill("0.5"); // Hạn cược 30 giây, đủ để làm phép thử thị trường mới xuất hiện
  await page.getByRole("button", { name: "Create market" }).click(); // Tạo thị trường
  const card = page.locator(".card", { hasText: QUESTION }); // Thẻ của thị trường vừa tạo
  await card.waitFor({ timeout: 20000 }); step("create market"); // Thẻ xuất hiện

  await card.locator("input[type=number]").fill("0.5"); // Số tiền cược
  const accounts = await rpc("eth_accounts", []); // Tài khoản mở sẵn của Hardhat
  const other = encodeFunctionData({ abi: parseAbi(["function createMarket(string question, uint64 bettingEndsAt) returns (uint256)"]), functionName: "createMarket", args: [OTHER_QUESTION, BigInt(Math.floor(Date.now() / 1000) + 3600)] }); // Dữ liệu gọi tạo một thị trường khác
  await rpc("eth_sendTransaction", [{ from: accounts[1], to: MARKET, data: other, gas: "0x100000" }]); // Người khác tạo thị trường mới trong lúc mình đang gõ
  await page.getByText(OTHER_QUESTION).waitFor({ timeout: 20000 }); // Trang tự tải lại và hiện thị trường mới
  if ((await card.locator("input[type=number]").inputValue()) !== "0.5") throw new Error("Amount input was reset when a new market appeared"); // Số đang gõ không được mất
  step("typed amount survives a new market appearing"); // Qua phép thử lỗi cũ
  await card.getByRole("button", { name: "Bet Yes" }).click(); // Cược Yes
  await card.locator(".status.ok").waitFor({ timeout: 20000 }); step("bet Yes 0.5"); // Cược thành công

  await card.getByText("Betting ended").waitFor({ timeout: 40000 }); step("betting ended"); // Chờ hết hạn cược
  await card.locator("input[type=number]").fill("0.2"); // Số tiền cọc
  await card.getByRole("button", { name: "Bond Yes" }).click(); // Cọc Yes
  await card.getByText("Bond leader: Yes").waitFor({ timeout: 20000 }); step("bond Yes 0.2, window open"); // Cửa sổ phán quyết mở

  await card.getByText("ready to finalize").waitFor({ timeout: 120000 }); step("window over"); // Chờ hết cửa sổ (60 giây khi deploy mặc định)
  await card.getByRole("button", { name: "Finalize" }).click(); // Chốt kết quả
  await card.getByText("Finished: Yes").waitFor({ timeout: 20000 }); step("finalize: Yes wins"); // Yes thắng

  await card.getByRole("button", { name: /^Claim 0\.7/ }).click(); // Nhận 0.7 (0.5 cược + 0.2 cọc, vì là người duy nhất ở cả hai quỹ)
  await card.locator(".status.ok").waitFor({ timeout: 20000 }); step("claim 0.7"); // Nhận thành công

  await browser.close(); // Đóng trình duyệt
  console.log("\nE2E PASSED"); // Báo đạt
}

main().catch((error) => { // Nếu có bước nào lỗi
  console.log("\nE2E FAILED:", error.message); // In lỗi
  process.exit(1); // Thoát với mã lỗi
});
