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
- Deployed on Portaldot V3 testnet (chain ID 420420777): `PredictionMarket` at `0xF73AF8c6a914d390A4F17FFa28535aa26c23B659`, deploy tx `0xa03b90eef388a35279637ee4c423f57785ef84694c16f28485553c4822eecaa1`. The full flow (create, bet, bond, finalize, claim) ran on testnet, all transaction hashes are in the README.
- Finding: deploying on pallet_revive costs about 530 tPOT for a 6.7 KB contract (storage deposit), so contract size matters on this chain.

**Remaining**
- Point the web app at the testnet deployment and test with MetaMask on Portaldot.
- Reduce contract size to cut the deploy fee.
- Extend the resolution window when a large bond arrives in the last minutes (anti last-second bond).
- Final demo video, pitch deck.

---

## Video demo (dưới 3 phút)

Đã có testnet thật: quay `npm run demo:testnet` (terminal) và web app trỏ vào testnet (xem README, phần Web app). Nên mở địa chỉ contract trong Node Console (https://node-console.portaldot.dev/) để chứng minh giao dịch thật.

1. (20 giây) Vấn đề: thị trường dự đoán cần người báo kết quả, người đó có thể gian lận hoặc phải tin admin.
2. (20 giây) Giải pháp: đấu cọc, phe cọc nhiều hơn thắng, không oracle, không admin.
3. (100 giây) Trên web app: kết nối MetaMask, tạo câu hỏi (hạn cược 0.5 phút), cược Yes, chờ hết hạn, cọc Yes, chờ cửa sổ 60 giây, Finalize, Claim.
4. (20 giây) Màn hình `npm run check:network` cho thấy đã kết nối testnet Portaldot (chain ID 420420777).
5. (20 giây) Việc tiếp theo.
