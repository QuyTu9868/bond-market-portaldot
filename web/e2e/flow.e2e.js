// Test E2E (bấm như người dùng thật) cho toàn luồng: kết nối ví, tạo thị trường, cược, cọc, chốt, nhận tiền.
// Điều kiện trước: terminal 1 chạy `npm run node`, terminal 2 chạy `npm run deploy:local` (ở thư mục gốc), terminal 3 chạy `npm run dev` (trong web/).
// Chạy: npm run test:e2e (trong web/). Dùng trình duyệt Edge cài sẵn trên Windows.
// Ví giả: window.ethereum chuyển mọi lệnh sang node Hardhat, dùng tài khoản mở sẵn của Hardhat (không cần MetaMask, không có khóa thật).
const { chromium } = require("playwright-core"); // Điều khiển trình duyệt
const { encodeFunctionData, parseAbi } = require("viem"); // Mã hóa lệnh gọi contract cho "người dùng khác"
const WATCH = process.argv.includes("--watch"); // Chế độ xem: hiện cửa sổ trình duyệt và bấm chậm lại cho người xem theo dõi
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

async function holdConfirm(page, card) { // Nhấn giữ nút xác nhận đủ lâu (nút cần giữ khoảng 0.8 giây)
  const button = card.getByRole("button", { name: "Hold to confirm" }); // Nút nhấn giữ
  await button.scrollIntoViewIfNeeded(); // Đưa vào màn hình
  const box = await button.boundingBox(); // Vị trí nút
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // Rê chuột vào giữa nút
  await page.mouse.down(); // Nhấn xuống
  await page.waitForTimeout(1200); // Giữ lâu hơn thời gian yêu cầu
  await page.mouse.up(); // Thả ra
}

async function txDone(card) { // Chờ giao dịch trên thẻ xong, báo lỗi rõ nếu thất bại
  const status = card.locator(".status.ok, .status.error").first(); // Dòng trạng thái
  await status.waitFor({ timeout: 30000 }); // Chờ xuất hiện
  if ((await status.getAttribute("class")).includes("error")) throw new Error("Transaction failed on page: " + (await status.innerText())); // Thất bại thì dừng kèm lý do
}

async function holdConfirm(page, card) { // Nhấn giữ nút xác nhận đủ lâu (nút cần giữ khoảng 0.8 giây)
  const button = card.getByRole("button", { name: "Hold to confirm" }); // Nút nhấn giữ
  await button.scrollIntoViewIfNeeded(); // Đưa vào màn hình
  const box = await button.boundingBox(); // Vị trí nút
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // Rê chuột vào giữa nút
  await page.mouse.down(); // Nhấn xuống
  await page.waitForTimeout(1200); // Giữ lâu hơn thời gian yêu cầu
  await page.mouse.up(); // Thả ra
}

async function txDone(card) { // Chờ giao dịch trên thẻ xong, báo rõ lý do nếu thất bại
  const status = card.locator(".status.ok, .status.error").first(); // Dòng trạng thái
  await status.waitFor({ timeout: 30000 }); // Chờ xuất hiện
  if ((await status.getAttribute("class")).includes("error")) throw new Error("Transaction failed on page: " + (await status.innerText())); // Thất bại thì dừng kèm lý do
}

async function main() { // Hàm chính
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: !WATCH, slowMo: WATCH ? 700 : 0, args: WATCH ? ["--window-size=1280,900"] : [] }); // Mở Edge (đổi sang "chrome" nếu cần)
  const page = await browser.newPage(); // Mở tab mới
  globalThis.__page = page; // Giữ lại để chụp màn hình nếu test thất bại
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
  const other = encodeFunctionData({ abi: parseAbi(["function createMarket(string question, uint64 bettingEndsAt, uint8 category) returns (uint256)"]), functionName: "createMarket", args: [OTHER_QUESTION, BigInt(Math.floor(Date.now() / 1000) + 3600), 1] }); // Dữ liệu gọi tạo một thị trường khác
  await rpc("eth_sendTransaction", [{ from: accounts[1], to: MARKET, data: other, gas: "0x100000" }]); // Người khác tạo thị trường mới trong lúc mình đang gõ
  await page.getByText(OTHER_QUESTION).waitFor({ timeout: 20000 }); // Trang tự tải lại và hiện thị trường mới
  if ((await card.locator("input[type=number]").inputValue()) !== "0.5") throw new Error("Amount input was reset when a new market appeared"); // Số đang gõ không được mất
  step("typed amount survives a new market appearing"); // Qua phép thử lỗi cũ
  await card.getByRole("button", { name: "Bet Yes" }).click(); // Cược Yes
  await holdConfirm(page, card); // Nhấn giữ để xác nhận
  await txDone(card); step("bet Yes 0.5"); // Cược thành công

  await card.getByText("Betting ended").waitFor({ timeout: 40000 }); step("betting ended"); // Chờ hết hạn cược
  await card.locator("input[type=number]").fill("0.2"); // Số tiền cọc
  await card.getByRole("button", { name: "Bond Yes" }).click(); // Cọc Yes
  await holdConfirm(page, card); // Nhấn giữ để xác nhận
  await txDone(card); await txDone(card); await card.getByText("Bond leader: Yes").waitFor({ timeout: 20000 }); step("bond Yes 0.2, window open"); // Cửa sổ phán quyết mở

  await card.getByText("ready to finalize").waitFor({ timeout: 120000 }); step("window over"); // Chờ hết cửa sổ (60 giây khi deploy mặc định)
  await card.getByRole("button", { name: "Finalize" }).click(); // Chốt kết quả
  await card.getByText("Finished: Yes").waitFor({ timeout: 20000 }); step("finalize: Yes wins"); // Yes thắng

  await card.getByRole("button", { name: /^Claim 0\.7/ }).click(); // Nhận 0.7 (0.5 cược + 0.2 cọc, vì là người duy nhất ở cả hai quỹ)
  await txDone(card); step("claim 0.7");

  await page.evaluate(() => { window.location.hash = "#portfolio"; }); // Mở trang Portfolio
  const row = page.locator(".pf-row", { hasText: QUESTION }); // Dòng của thị trường vừa chơi
  await row.waitFor({ timeout: 20000 }); // Chờ dòng xuất hiện
  if (!(await row.innerText()).includes("Done")) throw new Error("Portfolio row does not show the claim as done"); // Đã nhận phải hiện Done
  step("portfolio shows the position as claimed"); // Qua kiểm tra Portfolio

  await page.evaluate(() => { window.location.hash = "#markets"; }); // Về danh sách
  await page.getByLabel("Search markets").fill(QUESTION); // Tìm đúng câu hỏi
  await page.waitForTimeout(600); // Chờ lọc
  if ((await page.locator(".markets .card").count()) !== 1) throw new Error("Search should leave exactly one market"); // Chỉ còn một thẻ
  step("search leaves exactly one market"); // Qua kiểm tra tìm kiếm // Nhận thành công

  if (WATCH) await page.waitForTimeout(6000); // Chế độ xem: dừng vài giây để người xem thấy kết quả cuối
  await browser.close(); // Đóng trình duyệt
  console.log("\nE2E PASSED"); // Báo đạt
}

main().catch(async (error) => { // Nếu có bước nào lỗi
  try { await globalThis.__page?.screenshot({ path: "e2e-failure.png", fullPage: true }); } catch (e) { /* Không chụp được thì bỏ qua */ } // Chụp lại trang lúc lỗi để chẩn đoán
  console.log("\nE2E FAILED:", error.message); // In lỗi
  process.exit(1); // Thoát với mã lỗi
});
