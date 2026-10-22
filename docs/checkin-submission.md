# Week 2 check-in: text to paste on DoraHacks

Dán phần tiếng Anh bên dưới vào ô "Project Progress" trên DoraHacks. Sửa dòng testnet nếu đã deploy được trước khi nộp.

---

**Bond Market: a prediction market resolved by a bond war, no oracle, no admin.**

Anyone can create a Yes/No question and bet with native tokens. After betting closes, anyone can post a bond on Yes or No during a resolution window. When the window ends, the side with the larger total bond wins and takes the losing bonds. If bonds tie, or nobody bonds for 7 days, everyone is refunded. The contract has no owner and no admin functions.

**Done**
- `PredictionMarket.sol` (Solidity, Hardhat): create, bet, bond, finalize, claim, refunds. 27 unit tests passing.
- Slither static analysis: no high or medium findings.
- Web app (Next.js + wagmi + MetaMask): list markets with live countdowns, create, bet, bond, finalize, claim. Every transaction shows waiting for signature, confirming, done, or a readable error.
- End-to-end browser test of the full flow (connect, create, bet, bond, finalize, claim) passing on a local chain.
- Portaldot V3 testnet connection verified: chain ID 420420777, RPC live.

**Remaining**
- Testnet deployment: waiting for tPOT to reach our EVM (0x) address. Contract address and transaction hashes will be added to the README right after.
- Extend the resolution window when a large bond arrives in the last minutes (anti last-second bond).
- Final demo video, pitch deck.

---

## Video demo (dưới 3 phút)

Nếu chưa có testnet: quay trên mạng ảo local theo README (phần Quick start và Web app). Thông báo của ban tổ chức cho phép mock data ở bước này, nhưng nói rõ trong video là đang chạy local và lý do (chờ tPOT).

1. (20 giây) Vấn đề: thị trường dự đoán cần người báo kết quả, người đó có thể gian lận hoặc phải tin admin.
2. (20 giây) Giải pháp: đấu cọc, phe cọc nhiều hơn thắng, không oracle, không admin.
3. (100 giây) Trên web app: kết nối MetaMask, tạo câu hỏi (hạn cược 0.5 phút), cược Yes, chờ hết hạn, cọc Yes, chờ cửa sổ 60 giây, Finalize, Claim.
4. (20 giây) Màn hình `npm run check:network` cho thấy đã kết nối testnet Portaldot (chain ID 420420777).
5. (20 giây) Việc tiếp theo.
