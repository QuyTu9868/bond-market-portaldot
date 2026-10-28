// Test toàn bộ luồng của dapp trên Portaldot testnet THẬT bằng giao diện thật và HAI ví (mỗi ví một cửa sổ trình duyệt).
// Điều kiện trước: web/.env.local trỏ vào testnet và có PRIVATE_KEY1, PRIVATE_KEY2 (hai ví đều có tPOT), `npm run dev` đang chạy ở cổng 3000.
// Chạy: npm run test:testnet (trong web/). Mất khoảng 10 phút. Mỗi lệnh cược hoặc cọc chỉ 0.05 đến 0.1 tPOT, phần tốn nhất là phí lưu trữ khi tạo thị trường.
// Khóa riêng chỉ được đọc để ký giao dịch, không bao giờ in ra.
const { chromium } = require("playwright-core"); // Điều khiển trình duyệt
const { createWalletClient, http } = require("viem"); // Ký và gửi giao dịch
const { privateKeyToAccount } = require("viem/accounts"); // Tạo tài khoản từ khóa riêng
const fs = require("fs"); // Đọc file
const path = require("path"); // Ghép đường dẫn

const APP = process.env.APP_URL || "http://localhost:3000"; // Địa chỉ app
const RPC = "https://test-evm-rpc-v3.portaldot.dev"; // RPC testnet Portaldot
const CHAIN = { id: 420420777, name: "Portaldot V3 Testnet", nativeCurrency: { name: "tPOT", symbol: "tPOT", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }; // Khai báo mạng
const STAMP = Date.now(); // Dấu thời gian để đặt tên thị trường riêng cho mỗi lần chạy
const LONG = 150000; // Thời gian chờ dài cho giao dịch trên chuỗi thật (mili giây)

function readKey(name) { // Đọc một khóa từ web/.env.local, không in ra
  const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8"); // Đọc file
  const match = env.match(new RegExp("^" + name + "=(0x[0-9a-fA-F]{64}|[0-9a-fA-F]{64})\\s*$", "m")); // Tìm dòng khóa
  if (!match) throw new Error(name + " not found in web/.env.local"); // Thiếu khóa
  return match[1].startsWith("0x") ? match[1] : "0x" + match[1]; // Chuẩn hóa có 0x
}

async function rpc(method, params) { // Gọi RPC thẳng
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); // Gửi
  const json = await res.json(); // Đọc
  if (json.error) throw new Error(json.error.message); // Báo lỗi
  return json.result; // Trả kết quả
}

const log = (msg) => console.log(new Date().toISOString().slice(11, 19), msg); // In kèm giờ
const results = []; // Kết quả từng kiểm tra
function check(name, ok, detail = "") { results.push({ name, ok }); console.log(ok ? "  PASS" : "  FAIL", name, detail); } // Ghi một kiểm tra

async function openWallet(browser, key, label) { // Mở một cửa sổ có ví giả ký bằng khóa thật
  const account = privateKeyToAccount(key); // Tài khoản
  const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC) }); // Máy khách ví
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" }); // Cửa sổ riêng
  const page = await context.newPage(); // Tab
  page.on("pageerror", (e) => console.log("  PAGE ERROR", label + ":", e.message.slice(0, 200))); // In lỗi JS
  await page.exposeFunction("walletRequest", async (method, params) => { try { for (let attempt = 1; ; attempt++) { try { return await walletHandle(method, params); } catch (e) { const busy = String(e.details || e.message || "").includes("503"); if (!busy || attempt >= 6) throw e; await new Promise((r) => setTimeout(r, 4000)); } } } catch (e) { console.log("  RPC ERROR", label, method, (e.details || e.shortMessage || e.message || "").slice(0, 300)); throw e; } }); // Cầu nối ví, in lỗi RPC thật để chẩn đoán
  const walletHandle = async (method, params) => { // Xử lý từng yêu cầu của app
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [account.address]; // Trả địa chỉ ví
    if (method === "wallet_switchEthereumChain") return null; // Đã đúng mạng
    if (method === "eth_sendTransaction") { // Ký và gửi giao dịch
      const tx = params[0]; // Nội dung
      return wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined, gas: tx.gas ? BigInt(tx.gas) : undefined, type: "legacy", gasPrice: BigInt(await rpc("eth_gasPrice", [])) }); // Giao dịch kiểu legacy
    }
    return rpc(method, params || []); // Còn lại chuyển cho node
  };
  await page.addInitScript(() => { window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, request: ({ method, params }) => window.walletRequest(method, params || []) }; }); // Giả lập window.ethereum
  await page.goto(APP); // Mở app
  await page.getByRole("button", { name: "Connect wallet" }).click(); // Kết nối
  await page.getByText("Create a market").waitFor({ timeout: 60000 }); // Form tạo hiện ra khi đã kết nối
  return { page, account, label }; // Trả về
}

async function holdConfirm(page, card) { // Nhấn giữ nút xác nhận đủ lâu
  const button = card.getByRole("button", { name: "Hold to confirm" }); // Nút nhấn giữ
  await button.scrollIntoViewIfNeeded(); // Đưa vào màn hình
  const box = await button.boundingBox(); // Vị trí
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // Rê chuột vào giữa
  await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up(); // Giữ rồi thả
}

async function txDone(card, label) { // Chờ giao dịch trên thẻ xong, báo lỗi rõ nếu thất bại
  const status = card.locator(".status.ok, .status.error").first(); // Dòng trạng thái
  await status.waitFor({ timeout: LONG }); // Chờ xuất hiện
  if ((await status.getAttribute("class")).includes("error")) throw new Error(label + " failed on page: " + (await status.innerText())); // Thất bại thì dừng
}

async function findCard(page, question) { // Tìm thẻ của thị trường vừa tạo bằng ô tìm kiếm
  await page.getByLabel("Search markets").fill(question); // Gõ câu hỏi
  const card = page.locator(".markets .card", { hasText: question }).first(); // Thẻ
  await card.waitFor({ timeout: LONG }); // Chờ thẻ hiện (trang tự tải lại mỗi 5 giây)
  return card; // Trả về
}

async function placeAction(page, card, buttonName, amount, label) { // Nhập tiền, bấm Bet hoặc Bond, nhấn giữ xác nhận, chờ xong
  await card.locator("input[type=number]").fill(amount); // Số tiền
  await card.getByRole("button", { name: buttonName }).click(); // Chọn phe
  await holdConfirm(page, card); // Xác nhận bằng cách nhấn giữ
  await txDone(card, label); // Chờ giao dịch xong
  log(label + " done");
}

async function createMarket(page, question, categoryIndex) { // Tạo một thị trường qua form
  await page.fill("input[placeholder^='A Yes/No']", question); // Câu hỏi
  await page.selectOption("form.card select", String(categoryIndex)); // Danh mục
  await page.locator("form.card input[type=number]").fill("2"); // Cược mở 2 phút, đủ cho chuỗi thật chậm
  await page.getByRole("button", { name: "Create market" }).click(); // Tạo
  log("create market submitted: " + question);
}

async function runScenario(browser, w1, w2, { question, category, w1Bet, w2Bet, w1Bond, w2Bond, expect }) { // Một kịch bản đầy đủ từ tạo đến nhận tiền
  await createMarket(w1.page, question, category); // Ví 1 tạo thị trường
  const c1 = await findCard(w1.page, question); // Thẻ trên cửa sổ ví 1
  log("market visible for wallet 1");
  const c2 = await findCard(w2.page, question); // Thẻ trên cửa sổ ví 2
  log("market visible for wallet 2");
  await placeAction(w1.page, c1, "Bet Yes", w1Bet, "wallet 1 bet Yes " + w1Bet); // Ví 1 cược Yes
  await placeAction(w2.page, c2, "Bet No", w2Bet, "wallet 2 bet No " + w2Bet); // Ví 2 cược No
  await c1.locator(".rules summary", { hasText: "Activity chart" }).click(); // Mở biểu đồ
  await c1.locator(".chart svg").waitFor({ timeout: 60000 }); // Biểu đồ phải vẽ được từ nhật ký sự kiện trên chuỗi thật
  check("activity chart renders from real chain events", true); // Đạt
  await c1.getByText("Betting ended").waitFor({ timeout: 240000 }); // Chờ hết hạn cược
  log("betting ended");
  await c2.getByText("Betting ended").waitFor({ timeout: 120000 }); // Ví 2 cũng thấy hết hạn cược
  await c2.locator("input[type=number]").fill(w2Bond); // Ví 2 chuẩn bị sẵn số tiền cọc No trước khi ví 1 mở cửa sổ
  await c2.getByRole("button", { name: "Bond No" }).click(); // Ví 2 mở sẵn bước xác nhận
  log("wallet 2 bond No prepared, waiting for confirm");
  await placeAction(w1.page, c1, "Bond Yes", w1Bond, "wallet 1 bond Yes " + w1Bond); // Ví 1 cọc Yes, mở cửa sổ 60 giây
  await holdConfirm(w2.page, c2); // Ví 2 xác nhận ngay, không chờ giao diện làm mới
  log("wallet 2 hold released, waiting for tx");
  await txDone(c2, "wallet 2 bond No " + w2Bond); // Chờ cọc của ví 2 xong
  log("wallet 2 bond No " + w2Bond + " done");
  await c1.getByText("ready to finalize").waitFor({ timeout: 300000 }); // Chờ hết cửa sổ phán quyết
  log("window over");
  await c1.getByRole("button", { name: "Finalize" }).click(); // Chốt (không cần xác nhận nhấn giữ)
  await txDone(c1, "finalize"); // Chờ xong
  await c1.getByText(expect.finishedText).waitFor({ timeout: 60000 }); // Đúng kết quả
  check("finalize shows " + expect.finishedText, true); // Đạt
  await c2.getByText(expect.finishedText).waitFor({ timeout: 60000 }); // Ví 2 cũng thấy kết quả
  for (const [wallet, card, label] of [[w2, c2, "wallet 2"], [w1, c1, "wallet 1"]]) { // Kiểm tra từng ví nhận gì
    const amount = label === "wallet 2" ? expect.w2Claim : expect.w1Claim; // Số tiền kỳ vọng
    if (amount) { // Có tiền để nhận
      await card.getByRole("button", { name: new RegExp("^Claim " + amount.replace(".", "\\.")) }).click(); // Bấm Claim đúng số tiền
      await txDone(card, label + " claim"); // Chờ xong
      check(label + " claimed " + amount, true); // Đạt
    } else { // Phe thua không có gì
      const disabled = await card.getByRole("button", { name: /^Claim/ }).isDisabled(); // Nút Claim phải bị khóa
      check(label + " (loser) cannot claim", disabled); // Đạt nếu khóa
    }
  }
}

async function main() { // Hàm chính
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge" }); // Mở Edge
  const w1 = await openWallet(browser, readKey("PRIVATE_KEY1"), "wallet 1"); // Ví 1
  const w2 = await openWallet(browser, readKey("PRIVATE_KEY2"), "wallet 2"); // Ví 2
  globalThis.__pages = [w1.page, w2.page]; // Để chụp màn hình nếu lỗi
  log("both wallets connected: " + w1.account.address.slice(0, 8) + " and " + w2.account.address.slice(0, 8));

  // Kiểm tra giao diện không tốn giao dịch
  const p = w1.page; // Cửa sổ ví 1
  check("price ticker is visible", await p.locator(".ticker .coin").first().isVisible().catch(() => false)); // Dải giá
  check("how it works block is visible", await p.getByText("How it works").first().isVisible()); // Khối giải thích
  await p.getByRole("button", { name: /^Esports/ }).click(); await p.getByRole("button", { name: /^All/ }).click(); // Bấm thử các tab danh mục
  check("category tabs work", true); // Đạt nếu không lỗi
  await p.getByLabel("Search markets").fill("zzz-no-such-market"); // Tìm thứ không có
  check("search with no match shows the empty message", await p.getByText("No markets match your filters.").isVisible()); // Thông báo rỗng
  await p.getByLabel("Search markets").fill(""); // Xóa tìm kiếm
  await p.getByRole("button", { name: /Dark mode|Light mode/ }).click(); // Chuyển giao diện
  const theme = await p.evaluate(() => document.documentElement.dataset.theme); // Chế độ hiện tại
  check("theme toggle sets a theme", theme === "light" || theme === "dark", "(" + theme + ")"); // Đạt
  await p.getByRole("button", { name: /Dark mode|Light mode/ }).click(); // Chuyển lại

  log("=== SCENARIO A: bond war, No outbids Yes ===");
  await runScenario(browser, w1, w2, { question: `TNET ${STAMP} A: will No win the bond war?`, category: 1, w1Bet: "0.1", w2Bet: "0.1", w1Bond: "0.05", w2Bond: "0.1", expect: { finishedText: "Finished: No", w2Claim: "0.35", w1Claim: null } }); // Ví 2 thắng

  // Kiểm tra giao diện trên thị trường có tiền thật
  const questionA = `TNET ${STAMP} A: will No win the bond war?`; // Câu hỏi A
  const cardA = await findCard(w1.page, questionA); // Thẻ A
  await cardA.getByRole("link", { name: "Open page" }).click(); // Mở trang riêng
  await w1.page.waitForTimeout(2500); // Chờ vẽ
  const hash = await w1.page.evaluate(() => window.location.hash); // Địa chỉ riêng
  check("market page has its own shareable link", /^#m=\d+$/.test(hash), "(" + hash + ")"); // Đạt
  await w1.page.getByRole("link", { name: "Portfolio" }).click(); // Mở Portfolio
  await w1.page.locator(".pf-row", { hasText: questionA }).waitFor({ timeout: 60000 }); // Dòng của thị trường A
  check("wallet 1 portfolio lists the market", true); // Đạt
  await w2.page.getByRole("link", { name: "Portfolio" }).click(); // Portfolio ví 2
  const rowA = w2.page.locator(".pf-row", { hasText: questionA }); await rowA.waitFor({ timeout: 60000 }); // Dòng của ví 2
  check("wallet 2 portfolio shows the claim as done", (await rowA.innerText()).includes("Done")); // Phải hiện Done
  await w1.page.getByRole("link", { name: "Markets" }).click(); await w2.page.getByRole("link", { name: "Markets" }).click(); // Về danh sách

  log("=== SCENARIO B: bonds tie, everyone is refunded ===");
  await runScenario(browser, w1, w2, { question: `TNET ${STAMP} B: will the bonds tie?`, category: 0, w1Bet: "0.05", w2Bet: "0.05", w1Bond: "0.05", w2Bond: "0.05", expect: { finishedText: "Finished: Invalid", w2Claim: "0.1", w1Claim: "0.1" } }); // Hòa cọc hoàn tiền

  await browser.close(); // Đóng
  const failed = results.filter((r) => !r.ok); // Kiểm tra thất bại
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`); // Tổng kết
  console.log(failed.length === 0 ? "TESTNET FULL TEST PASSED" : "TESTNET FULL TEST FAILED"); // Kết luận
  process.exit(failed.length === 0 ? 0 : 1); // Mã thoát
}

main().catch(async (error) => { // Nếu có bước nào lỗi
  console.log("\nTESTNET FULL TEST FAILED:", error.message.slice(0, 400)); // In lỗi
  for (const [i, page] of (globalThis.__pages || []).entries()) { try { await page.screenshot({ path: `testnet-failure-${i + 1}.png`, fullPage: true }); } catch (e) { /* Không chụp được thì bỏ qua */ } } // Chụp lại hai cửa sổ để chẩn đoán
  process.exit(1); // Thoát với mã lỗi
});
