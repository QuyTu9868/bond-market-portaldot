# Implementation notes

Ghi lại mọi quyết định Claude phải tự đưa ra mà đặc tả không nói tới, những thứ đã đổi, các đánh đổi, và việc chưa làm. Bạn đọc file này trước khi duyệt checkpoint.

## ĐỔI HƯỚNG (22/10): từ Launchpad sang Prediction Market

Dự án đổi sang thị trường dự đoán Yes/No kiểu Polymarket, kết quả chốt bằng cuộc đấu cọc thay cho oracle. Code Launchpad cũ nằm nguyên trong `archive/launchpad/` (không biên dịch, không chạy). Mọi mục bên dưới tiêu đề "Launchpad cũ" chỉ còn giá trị lịch sử, trừ mục 2, 3, 10 (vẫn đúng).

### Quyết định tự đưa ra cho PredictionMarket (cần bạn xác nhận)

1. **Luật phán quyết: phe có tổng cọc lớn hơn thắng.** Ai cũng đặt cọc Yes hoặc No sau hạn cược, trong cửa sổ phán quyết. Cọc phe thua chia cho cọc phe thắng theo tỉ lệ. Hòa cọc thì hoàn tiền tất cả (cược và cọc).
2. **Cửa sổ phán quyết cố định, bắt đầu từ cọc đầu tiên, không gia hạn.** Rủi ro: ai đó cọc rất lớn ở giây cuối, người khác không kịp đối ứng. Cách vá nếu cần: mỗi cọc mới trong 10 phút cuối gia hạn thêm. Chưa làm vì tránh phức tạp, cần bạn quyết.
3. **Không có phí nền tảng, không hàm admin, người tạo thị trường không có quyền gì.** Test `has no admin or creator-only function` chứng minh điều này (chỉ 5 hàm ghi).
4. **Không ai cọc trong 7 ngày sau hạn cược thì hoàn tiền cược cho mọi người** (`NO_BOND_REFUND_DELAY`, ý tưởng mượn từ repo wager, bạn chọn 7 ngày). Ai cũng gọi `finalize` hoặc `claim` được. Sau khi đã hoàn thì không đặt cọc được nữa.
5. **Cược thắng chia cả quỹ cược theo tỉ lệ** (không tính phí). Nếu không ai cược phe thắng thì hoàn lại tiền cược cho mọi người.
6. **Cược một lần ở mức giá cố định, không có giá thay đổi theo thời gian** như Polymarket (không sổ lệnh, không AMM). Đây là chia quỹ (parimutuel), đơn giản nhất.
7. **Phần lẻ do làm tròn khi chia để lại trong contract** (tối đa vài wei). Chấp nhận được.
8. **`resolutionWindow` đặt ở constructor** (mặc định 60 giây khi demo, thật nên 24 giờ). Đọc từ `.env` (`RESOLUTION_WINDOW`).
9. **Thêm `previewPayout`** (chỉ đọc) để giao diện hiện trước số tiền sẽ nhận.
10. **Câu hỏi và hạn cược do người tạo tự nhập; contract không kiểm tra câu hỏi có rõ ràng hay không.** Đây là việc của giao diện hoặc cộng đồng.

### Đã kiểm tra

- `npm test`: 27 test đạt.
- `deploy:local` rồi `demo:local` trên mạng ảo: đạt (tạo, cược, cọc, chốt, nhận tiền).
- Slither (chạy trên máy bạn, 22/10): không có High hoặc Medium. Low: so sánh với `block.timestamp` (cố ý). Informational: gọi `call` để gửi tiền (cố ý, có `nonReentrant` và đánh dấu `claimed` trước khi gửi).

### CHƯA làm

- Chưa có frontend.

## Launchpad cũ (lịch sử)

## Quyết định tự đưa ra (cần bạn xác nhận)

1. **Phí chống bot về ví treasury (người deploy contract).** Đây là quyết định lớn nhất. Các lựa chọn khác: đốt, chia cho người giữ token, trả vào đường giá. Chọn treasury vì đơn giản nhất. Nhược điểm: người deploy có động cơ muốn bot mua sớm. Cần bạn quyết có đổi không.
2. **Hardhat v2, không phải v3.** Skill vibe-code-dapp ghi chú Hardhat v3 (Ignition, TypeScript). Mình chọn v2 vì khớp workflow local của bạn (`npx hardhat node`, `scripts/deploy`), chạy ổn trên Node 20 trở lên, và kiểm tra được trong môi trường của mình. Có thể chuyển sang v3 sau nếu bạn muốn.
3. **`evmVersion: "paris"`.** Tránh lệnh PUSH0. Một số mạng Substrate EVM chưa hỗ trợ. Nếu Portaldot hỗ trợ đủ, có thể bỏ dòng này.
4. **Cho bán sau khi tốt nghiệp.** Tốt nghiệp chỉ ngừng cho MUA. Lý do: chưa có DEX để chuyển thanh khoản, nếu cấm bán thì tiền của người giữ token bị kẹt vĩnh viễn trong contract.
5. **Phí kiểu ghi sổ rồi tự rút (`claimFees`).** Không gửi tiền ngay mỗi giao dịch. Tránh trường hợp ví nhận phí là contract chủ động revert để chặn giao dịch.
6. **Phí chống bot chỉ áp lúc MUA.** Phí người tạo áp cả mua và bán.
7. **Các con số tự chọn:** phí đầu 50%, cửa sổ 300 giây, phí người tạo tối đa 2%, bán 800 triệu trong 1 tỷ token, token ảo ban đầu 1,073 tỷ (theo tỉ lệ kiểu pump.fun).
8. **Tham số đường giá ở constructor, tính bằng đơn vị tiền gốc.** Mặc định testnet 0.3 và 0.85 vì token test có thể ít. Test local dùng 3 và 8.5. Cùng tỉ lệ.
9. **Thêm hàm `quoteBuy`.** Không có trong đặc tả, nhưng test và frontend cần biết trước sẽ nhận bao nhiêu token và mất bao nhiêu phí. Đây là hàm chỉ đọc.
10. **Dùng OpenZeppelin** cho ERC-20 và ReentrancyGuard (MIT). Phải khai báo ở README (đã khai).
11. **Dòng in ra ở script viết tiếng Việt không dấu.** Tránh lỗi hiển thị chữ trong terminal Windows. Comment trong code vẫn có dấu.

## Đã thay đổi so với kế hoạch lúc đầu

- Bỏ phần "tốt nghiệp sang DEX": chưa biết Portaldot có DEX nào.
- Test lúc đầu viết sai hai chỗ (so sánh hai lệnh ở hai trạng thái giá khác nhau, và báo giá đọc ở thời điểm khác lệnh mua). Đã sửa test, contract không đổi.

## Đã kiểm tra

- `npm test`: 16 test đạt (trên mạng ảo Hardhat).
- Chạy `deploy-launchpad.js` và `demo-trade.js` trên mạng ảo `hardhat node`: đạt. Phí chống bot hiện 50% lúc đầu và 39,83% sau 60 giây, đúng công thức.
- Slither: không có High hoặc Medium. Low: dùng `block.timestamp` (cố ý). Informational: gọi `call` để gửi tiền (cố ý, có `nonReentrant` và cập nhật số liệu trước khi gửi).
- Môi trường của Claude không tải được trình biên dịch Solidity từ internet, nên đã biên dịch bằng solcjs (bản đóng gói trong npm, cùng phiên bản 0.8.28). Trên máy bạn, Hardhat tự tải trình biên dịch bình thường ở lần `npm test` đầu tiên, nên lần đầu có thể chậm.

## CHƯA kiểm tra (cần làm trên máy bạn)

- Chưa chạy trên testnet Portaldot thật. Chưa biết: Portaldot có chạy Solidity bình thường không, RPC còn đúng không, số dư token ở địa chỉ 0x có không, token gốc có bao nhiêu chữ số thập phân ở lớp EVM. CP0 sẽ trả lời.
- Chưa chạy Slither trên Windows (cần Python). Kết quả quét ở trên chạy trên Linux. Nếu không cài được thì bỏ qua, đã có kết quả.
- Chưa có frontend.

## Chưa làm (cố ý, theo nguyên tắc chống over-engineering)

- Chuyển thanh khoản sang DEX.
- Hàm admin, tạm dừng khẩn cấp, nâng cấp contract.
- Điểm uy tín người tạo, tốt nghiệp theo thời gian.
- Verify source code trên explorer (chưa biết Portaldot có explorer hỗ trợ không).
