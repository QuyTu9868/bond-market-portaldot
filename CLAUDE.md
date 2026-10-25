# CLAUDE.md - Bond Market (Portaldot Hacker House 2026)

Đọc file này đầu tiên mỗi lần bắt đầu phiên làm việc. Chủ dự án là người mới học code, phần lớn code do AI viết, người dùng lo kế hoạch và quyết định thiết kế.

## Dự án là gì

Thị trường dự đoán Yes/No kiểu Polymarket (ai cũng tạo câu hỏi, cược Yes hoặc No bằng tiền gốc) chạy trên testnet Portaldot V3 (EVM). Cải tiến so với Polymarket: kết quả chốt bằng cuộc đấu cọc, không cần oracle (nguồn dữ liệu ngoài). Sau hạn cược, ai cũng đặt cọc cho Yes hoặc No trong một cửa sổ thời gian; hết cửa sổ, phe có tổng cọc lớn hơn thắng, cọc phe thua chia cho phe thắng. Cọc đặt ở phần tư cuối của cửa sổ sẽ kéo dài cửa sổ thêm một phần tư (chống cọc phút chót). Không hàm admin, người tạo không có quyền gì. Hòa cọc thì hoàn tiền.

Thi ở track Ecosystem DApps của Portaldot Hacker House 2026 (DoraHacks). Quyết định thiết kế và việc còn thiếu: `docs/implementation-notes.md`.

**Đổi hướng 22/10:** dự án ban đầu là Launchpad token meme, code cũ và ghi chú nghiên cứu cũ nằm ở `archive/launchpad/` (không chạy). README, kiến trúc, đặc tả và checklist check-in đã viết lại cho hướng mới.

## Quy tắc luôn áp dụng

### 1. Chống over-engineering (ưu tiên cao nhất)
- Chọn giải pháp đơn giản nhất chạy được.
- Không thêm abstraction, tính năng hay tham số ngoài yêu cầu.
- Muốn làm phức tạp thêm thì HỎI TRƯỚC, đừng tự làm.
- Contract viết vừa đủ. Không proxy nâng cấp, không hàm admin, không tham số hoá quá mức khi chưa cần.
- Chỉ làm đúng việc được yêu cầu. Thấy vấn đề khác thì báo lại, không tự sửa.

### 2. Không dùng em dash
TUYỆT ĐỐI không dùng dấu gạch dài trong mọi nội dung (code, tài liệu, giao diện, bài viết). Chỉ dùng dấu "-" hoặc bỏ luôn.

### 3. Xử lý điều kiện tiên quyết trước
Chức năng nào cần bước trước (đã có ví, đã có token test, đã deploy contract, đã approve token...) thì kiểm tra và xử lý bước đó trước, không nhảy thẳng vào chức năng chính. Thiếu điều kiện thì dừng và báo.

### 4. Chẩn đoán lỗi trước khi sửa
Khi có lỗi hoặc được báo lỗi: tìm nguyên nhân gốc, giải thích cho người dùng, CHỜ DUYỆT rồi mới sửa code. Không sửa mò.

### Quy tắc phụ
- Trả lời bằng tiếng Việt, gọi người dùng là "bạn", ngắn gọn, thuật ngữ kỹ thuật giải thích ngay trong câu.
- Mỗi dòng code kèm 1 comment giải thích dòng đó làm gì.
- Tên biến và hàm đặt bằng tiếng Anh hoàn toàn.
- Không đặt hai file trùng tên, kể cả khác thư mục.
- Mỗi quyết định không có trong đặc tả thì ghi vào `docs/implementation-notes.md`.
- Khi đưa API hay thư viện ngoài, xác minh còn hoạt động thật trước.
- Gặp thứ không làm được (mạng bị chặn, thiếu quyền, thiếu file): báo NGAY, dừng và hỏi.
- Không bao giờ ghi khoá riêng (private key) hay seed phrase vào code, tài liệu hay chat. Khoá chỉ nằm trong `.env`.

## Quy trình mỗi checkpoint

1. Claude tự test rồi báo cáo kết quả.
2. Người dùng test lại một lượt và duyệt.
3. Git commit (một commit sau mỗi checkpoint chạy được).
4. Mới sang checkpoint kế tiếp.

Thứ tự build: contract + test local, quét Slither, frontend từ ABI, và deploy testnet là bước cuối của mỗi vòng. Dev và test chỉ dùng mạng ảo local (`npm run node`).

## Danh sách checkpoint (giờ Việt Nam)

Hạn quan trọng: check-in 19:00 ngày 24/10. Nộp bài cuối 11:00 ngày 6/11, sau đó code freeze.

- [x] **CP0 - Tiền kiểm mạng (22/10).** Có ví MetaMask riêng cho thử nghiệm, token test đã về, file `.env` đã điền, `npm install` xong, `npm run check:network` in "CHECKPOINT 0 DAT". Điều kiện đạt: chain ID đúng 420420777, số dư lớn hơn 0, deploy `Ping` và gọi `ping()` thành công. Nếu số dư bằng 0 hoặc deploy lỗi thì DỪNG, hỏi admin Portaldot, không viết thêm gì.
- [x] **CP1 - Contract và test local.** Code đã có sẵn (`contracts/PredictionMarket.sol`). Chạy `npm test`, 30 test phải đạt.
- [x] **CP2 - Quét Slither.** `slither . --filter-paths node_modules`. Không được có lỗi High hoặc Medium. Kết quả đã quét trước: chỉ có Low (dùng timestamp) và Informational (gọi call gửi tiền).
- [x] **CP3 - Chạy thử local.** Ba lệnh: `npm run node` (terminal 1), `npm run deploy:local` rồi `npm run demo:local` (terminal 2).
- [x] **CP4 - Deploy testnet (23/10).** `npm run deploy:testnet` rồi `npm run demo:testnet`. Lưu lại thư mục `deployments/` (địa chỉ contract và mã giao dịch). Git commit.
- [x] **CP5 - Hồ sơ check-in (24/10, xong trước 12:00 để có đệm).** Repo GitHub công khai, README đầy đủ, sơ đồ kiến trúc (`docs/architecture.md`), địa chỉ contract và tx hash, video demo dưới 3 phút. Nộp trên DoraHacks trước 19:00. Danh sách chi tiết: `docs/references/checkin-checklist.md`.
- [x] **CP6 - Frontend tối thiểu (xong 25/10, chưa thử MetaMask thật).** Next.js + wagmi (không dùng RainbowKit, xem implementation-notes): liệt kê thị trường, tạo thị trường, cược, đặt cọc phán quyết, đếm ngược cửa sổ, chốt và nhận tiền. Mọi nút giao dịch phải có đủ trạng thái (chờ ký, đang xác nhận, thành công kèm link explorer, thất bại với câu lỗi dễ hiểu). Test Playwright (`web/` chạy `npm run test:e2e`).
- [ ] **CP7 - Hoàn thiện (31/10 đến 4/11).** Pitch deck (PDF), video demo cuối, README hướng dẫn chạy, khai báo thư viện bên thứ ba, kiểm tra lịch sử commit rải đều.
- [ ] **CP8 - Nộp bài cuối (trước 11:00 ngày 6/11).** Sau đó code freeze, chỉ sửa lỗi nghiêm trọng và báo ban tổ chức.

## File tham chiếu (nghía lại khi cần)

| File | Đọc khi nào |
|---|---|
| `docs/references/hackathon-rules.md` | Cần nhớ luật, hạn, tiêu chí chấm, thứ phải nộp |
| `docs/references/network-info.md` | Cần RPC, chain ID, ví, token test, liên hệ admin |
| `docs/references/design-spec.md` | Sửa hoặc giải thích cơ chế contract, công thức giá, tham số |
| `docs/references/checkin-checklist.md` | Chuẩn bị hồ sơ check-in |
| `docs/architecture.md` | Cần sơ đồ kiến trúc cho hồ sơ |
| `docs/implementation-notes.md` | Xem các quyết định đã tự đưa ra, và việc còn chưa làm |

## Lệnh hay dùng

```
npm install              # cài thư viện (lần đầu)
npm test                 # chạy 30 test contract
npm run node             # bật mạng ảo local
npm run deploy:local     # deploy lên mạng ảo
npm run demo:local       # chạy kịch bản demo trên mạng ảo
npm run check:network    # CP0: kiểm tra testnet Portaldot
npm run deploy:testnet   # deploy lên testnet (bước cuối)
npm run demo:testnet     # demo trên testnet, lưu tx hash
```

## Rủi ro chưa xác minh (xem chi tiết trong implementation-notes)

- Chưa xác nhận Portaldot chạy Solidity bình thường (trang hackathon nói V3 tương thích EVM, tài liệu cũ không nhắc). CP0 sẽ kiểm chứng.
- Token test được phát về địa chỉ POT gốc (bắt đầu bằng số 5). Chưa rõ cách có số dư ở địa chỉ 0x của MetaMask.
- Chưa rõ số chữ số thập phân của token gốc ở lớp EVM.
- RPC và chain ID lấy từ trang hackathon ngày 20/10, cần kiểm tra lại.
