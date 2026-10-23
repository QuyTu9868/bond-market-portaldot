// Quay video demo web app chạy trên Portaldot testnet thật, có phụ đề từng bước.
// Điều kiện trước: web/.env.local trỏ vào testnet, `npm run dev` đang chạy ở cổng 3000, file .env ở thư mục gốc có PRIVATE_KEY và ví có tPOT.
// Chạy: npm run record (trong web/). Video lưu ở web/e2e/video/ (đuôi .webm).
// Ví tự động: window.ethereum ký bằng khóa trong .env (không phải MetaMask thật), và phụ đề đầu video có nói rõ điều này.
const { chromium } = require("playwright-core"); // Điều khiển trình duyệt
const { createWalletClient, http } = require("viem"); // Ký và gửi giao dịch
const { privateKeyToAccount } = require("viem/accounts"); // Tạo tài khoản từ khóa riêng
const fs = require("fs"); // Đọc file
const path = require("path"); // Ghép đường dẫn

const APP = process.env.APP_URL || "http://localhost:3000"; // Địa chỉ app
const RPC = "https://test-evm-rpc-v3.portaldot.dev"; // RPC testnet Portaldot
const CHAIN = { id: 420420777, name: "Portaldot V3 Testnet", nativeCurrency: { name: "tPOT", symbol: "tPOT", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }; // Khai báo mạng
const QUESTION = "Will Portaldot Hacker House 2026 have more than 100 projects?"; // Câu hỏi demo

function readPrivateKey() { // Đọc khóa từ .env ở thư mục gốc, không in ra
  const env = fs.readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8"); // Đọc file .env
  const match = env.match(/^PRIVATE_KEY=(0x[0-9a-fA-F]{64}|[0-9a-fA-F]{64})\s*$/m); // Tìm dòng khóa
  if (!match) throw new Error("PRIVATE_KEY not found in .env"); // Thiếu khóa
  return match[1].startsWith("0x") ? match[1] : "0x" + match[1]; // Chuẩn hóa có 0x
}

async function rpc(method, params) { // Gọi RPC thẳng
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); // Gửi
  const json = await res.json(); // Đọc kết quả
  if (json.error) throw new Error(json.error.message); // Báo lỗi
  return json.result; // Trả kết quả
}

async function main() { // Hàm chính
  const account = privateKeyToAccount(readPrivateKey()); // Ví tự động
  const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC) }); // Máy khách ví
  const videoDir = path.join(__dirname, "video"); // Thư mục video
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge" }); // Mở Edge
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } }); // Bật quay video
  const page = await context.newPage(); // Tab mới
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message)); // In lỗi JS

  await page.exposeFunction("walletRequest", async (method, params) => { // Cầu nối ví giả sang ví thật ký bằng khóa
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [account.address]; // Trả địa chỉ ví
    if (method === "wallet_switchEthereumChain") return null; // Đã đúng mạng
    if (method === "eth_sendTransaction") { // Ký và gửi giao dịch
      const tx = params[0]; // Nội dung giao dịch
      try { // Thử gửi, lỗi thì in chi tiết để chẩn đoán
        return await wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined, gas: tx.gas ? BigInt(tx.gas) : undefined, type: "legacy", gasPrice: BigInt(await rpc("eth_gasPrice", [])) }); // Giao dịch kiểu legacy vì chuỗi này chưa chắc hỗ trợ phí EIP-1559
      } catch (e) { // Bị node từ chối
        console.log("SEND FAILED selector", String(tx.data).slice(0, 10), "gas", tx.gas, "value", tx.value, "|", String(e.details || e.shortMessage || e.message).slice(0, 300)); // In bộ chọn hàm, gas, tiền và lý do
        throw e; // Ném lại để giao diện hiện lỗi
      }
    }
    return rpc(method, params || []); // Còn lại chuyển thẳng cho node
  });
  await page.addInitScript(() => { // Giả lập window.ethereum
    window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, request: ({ method, params }) => window.walletRequest(method, params || []) }; // Chuyển mọi yêu cầu sang cầu nối
    window.__caption = (text) => { // Hàm hiện phụ đề
      let el = document.getElementById("__cap"); // Tìm khung phụ đề
      if (!el) { el = document.createElement("div"); el.id = "__cap"; el.style.cssText = "position:fixed;left:0;right:0;bottom:0;padding:14px 24px;background:rgba(0,0,0,.82);color:#fff;font:600 20px system-ui,sans-serif;text-align:center;z-index:99999"; document.addEventListener("DOMContentLoaded", () => document.body.appendChild(el)); if (document.body) document.body.appendChild(el); } // Tạo khung phụ đề
      el.textContent = text; // Đổi nội dung
    };
  });
  const caption = (text) => page.evaluate((t) => window.__caption(t), text).catch(() => {}); // Đặt phụ đề
  const hold = (ms) => page.waitForTimeout(ms); // Dừng để người xem kịp đọc
  async function txDone(card) { // Chờ giao dịch xong, báo lỗi ngay nếu thất bại
    const status = card.locator(".status.ok, .status.error").first(); // Dòng trạng thái
    await status.waitFor({ timeout: 90000 }); // Chờ xuất hiện
    if ((await status.getAttribute("class")).includes("error")) throw new Error("Transaction failed on page: " + (await status.innerText())); // Thất bại thì dừng
  }
  console.log("Recording as", account.address); // In địa chỉ ví (công khai)

  await page.goto(APP); // Mở app
  await page.getByText("Markets").first().waitFor({ timeout: 30000 }); // Chờ trang tải
  await caption("Bond Market on Portaldot V3 testnet (chain 420420777). Recorded with an automated wallet."); await hold(3500); // Giới thiệu
  await caption("Contract 0xF73AF8c6a914d390A4F17FFa28535aa26c23B659. No oracle, no admin: the larger bond decides."); await hold(3500); // Địa chỉ contract

  await caption("1. Connect wallet"); await page.getByRole("button", { name: "Connect wallet" }).click(); // Kết nối ví
  await page.getByText("Create a market").waitFor({ timeout: 20000 }); await hold(1000); // Form tạo hiện ra

  await caption("2. Create a Yes/No market (betting open for 30 seconds)"); // Tạo thị trường
  await page.fill("input[placeholder^='A Yes/No']", QUESTION); await hold(1000); // Nhập câu hỏi
  await page.locator("label input").fill("0.5"); await hold(500); // Hạn cược 30 giây
  await page.getByRole("button", { name: "Create market" }).click(); // Bấm tạo
  const card = page.locator(".card", { hasText: QUESTION }).first(); // Thẻ thị trường
  await card.waitFor({ timeout: 90000 }); await hold(500); // Thẻ xuất hiện sau khi xác nhận trên chuỗi

  await caption("3. Place a Yes bet"); await hold(1000); // Dùng mức cược mặc định của giao diện
  await card.getByRole("button", { name: "Bet Yes" }).click(); // Bấm cược
  await txDone(card); await hold(1500); // Cược xác nhận

  await caption("4. Betting ends. Anyone can now post a bond on Yes or No"); // Hết hạn cược
  await card.getByText("Betting ended").waitFor({ timeout: 90000 }); await hold(6000); // Chờ hết hạn, dừng thêm vài giây vì giờ ước lượng ở giao diện có thể sớm hơn block thật
  await caption("Post a Yes bond"); await hold(500); // Dùng mức cọc mặc định
  await card.getByRole("button", { name: "Bond Yes" }).click(); // Cọc Yes
  await card.getByText("Bond leader: Yes").waitFor({ timeout: 90000 }); await hold(1500); // Cọc xác nhận

  await caption("5. Resolution window is open. The side with the larger bond wins. Waiting 60 seconds..."); // Cửa sổ phán quyết
  await card.getByText("ready to finalize").waitFor({ timeout: 150000 }); await hold(1000); // Hết cửa sổ

  await caption("6. Finalize: Yes has the larger bond, so Yes wins"); // Chốt
  await card.getByRole("button", { name: "Finalize" }).click(); // Bấm chốt
  await card.getByText("Finished: Yes").waitFor({ timeout: 90000 }); await hold(2000); // Đã chốt

  await caption("7. Winner claims bet plus bond payout"); // Nhận tiền
  await card.getByRole("button", { name: /^Claim 0\./ }).click(); // Bấm nhận
  await txDone(card); await hold(2500); // Nhận xong

  await caption("All steps ran on Portaldot V3 testnet. Code: github.com/QuyTu9868/bond-market-portaldot"); await hold(4000); // Kết thúc

  await context.close(); // Đóng để lưu video
  await browser.close(); // Đóng trình duyệt
  console.log("RECORDING DONE, see", videoDir); // Báo xong
}

main().catch((error) => { // Nếu lỗi
  console.log("RECORDING FAILED:", error.message); // In lỗi
  process.exit(1); // Thoát
});
