# Implementation notes

Ghi lại mọi quyết định Claude phải tự đưa ra mà đặc tả không nói tới, những thứ đã đổi, các đánh đổi, và việc chưa làm. Bạn đọc file này trước khi duyệt checkpoint.

## ĐỔI HƯỚNG (22/10): từ Launchpad sang Prediction Market

Dự án đổi sang thị trường dự đoán Yes/No kiểu Polymarket, kết quả chốt bằng cuộc đấu cọc thay cho oracle. Code Launchpad cũ nằm nguyên trong `archive/launchpad/` (không biên dịch, không chạy). Mọi mục bên dưới tiêu đề "Launchpad cũ" chỉ còn giá trị lịch sử, trừ mục 2, 3, 10 (vẫn đúng).

### Quyết định tự đưa ra cho PredictionMarket (cần bạn xác nhận)

1. **Luật phán quyết: phe có tổng cọc lớn hơn thắng.** Ai cũng đặt cọc Yes hoặc No sau hạn cược, trong cửa sổ phán quyết. Cọc phe thua chia cho cọc phe thắng theo tỉ lệ. Hòa cọc thì hoàn tiền tất cả (cược và cọc).
2. **Cửa sổ phán quyết bắt đầu từ cọc đầu tiên và TỰ KÉO DÀI khi có cọc ở phần tư cuối** (v2, bạn duyệt 25/10). Cọc đặt khi cửa sổ còn ít hơn `resolutionWindow / 4` thì hạn chốt dời thành lúc cọc cộng `resolutionWindow / 4`. Không có giới hạn số lần gia hạn, vì mỗi lần cần tiền cọc mới. Cửa sổ tối thiểu 4 giây.
3. **Không có phí nền tảng, không hàm admin, người tạo thị trường không có quyền gì.** Test `has no admin or creator-only function` chứng minh điều này (chỉ 5 hàm ghi).
4. **Không ai cọc trong 7 ngày sau hạn cược thì hoàn tiền cược cho mọi người** (`NO_BOND_REFUND_DELAY`, ý tưởng mượn từ repo wager, bạn chọn 7 ngày). Ai cũng gọi `finalize` hoặc `claim` được. Sau khi đã hoàn thì không đặt cọc được nữa.
5. **Cược thắng chia cả quỹ cược theo tỉ lệ** (không tính phí). Nếu không ai cược phe thắng thì hoàn lại tiền cược cho mọi người.
6. **Cược một lần ở mức giá cố định, không có giá thay đổi theo thời gian** như Polymarket (không sổ lệnh, không AMM). Đây là chia quỹ (parimutuel), đơn giản nhất.
7. **Phần lẻ do làm tròn khi chia để lại trong contract** (tối đa vài wei). Chấp nhận được.
8. **`resolutionWindow` đặt ở constructor** (mặc định 60 giây khi demo, thật nên 24 giờ). Đọc từ `.env` (`RESOLUTION_WINDOW`).
9. ~~Thêm `previewPayout`~~ ĐÃ BỎ ở v2 để giảm kích thước contract. Frontend tự tính trong `web/lib/payout.js` (cùng công thức với `_payout`, đã kiểm bằng test E2E: nhận 0.7).
10. **Câu hỏi và hạn cược do người tạo tự nhập; contract không kiểm tra câu hỏi có rõ ràng hay không.** Đây là việc của giao diện hoặc cộng đồng.

### Contract v2 (25/10, CHƯA deploy testnet, chờ bạn duyệt)

- Thêm chống cọc phút chót (xem mục 2), 3 test gia hạn mới. Đã kiểm bằng cách tắt dòng gia hạn: 2 test thất bại, bật lại thì đạt.
- Đổi mọi `require("...")` thành custom error (`error BettingClosed()` v.v.). Frontend đọc tên lỗi qua ABI và hiện câu dễ hiểu.
- Bỏ `previewPayout`. Kích thước deploy **6.750 xuống 5.309 byte (giảm 21%)** dù đã thêm tính năng. Ước lượng ban đầu của mình (30 đến 40%) quá lạc quan. Thử `optimizer runs: 1` chỉ giảm thêm 33 byte nên giữ `runs: 200`.
- Deploy v1 (đã nộp check-in) giữ nguyên trên testnet, file bằng chứng lưu ở `deployments/v1/`.
- Quét Slither v2: vẫn chỉ Low (timestamp) và Informational (call), không High hay Medium.

### Đã kiểm tra

- `npm test`: 30 test đạt (v2). Bản v1 có 27 test.
- `npm run test:e2e` (trình duyệt, mạng ảo) đạt với contract v2.
- `deploy:local` rồi `demo:local` trên mạng ảo: đạt (tạo, cược, cọc, chốt, nhận tiền).
- Slither (chạy trên máy bạn, 22/10): không có High hoặc Medium. Low: so sánh với `block.timestamp` (cố ý). Informational: gọi `call` để gửi tiền (cố ý, có `nonReentrant` và đánh dấu `claimed` trước khi gửi).

### Frontend (CP6, 22/10)

Quyết định tự đưa ra (cần bạn xác nhận):

1. **Không dùng RainbowKit**, chỉ wagmi + nút "Connect wallet" kết nối MetaMask (injected). RainbowKit cần WalletConnect project ID (đăng ký tài khoản ngoài). Thêm sau được nếu cần nhiều loại ví.
2. **JavaScript, không TypeScript**, một trang duy nhất, CSS tự viết. Giao diện tiếng Anh (cho ban giám khảo).
3. **Giờ theo chuỗi, không theo đồng hồ máy** (`web/lib/useChainNow.js`): contract chỉ tin giờ của block. Lỗi gặp khi test: máy và chuỗi lệch giờ làm giao dịch bị từ chối dù giao diện báo đã được phép.
4. **Mạng ảo Hardhat tạo thêm 1 block mỗi 5 giây** (`hardhat.config.js`). Trước đó node chỉ tạo block khi có giao dịch nên giờ của chuỗi đứng yên. Không ảnh hưởng test contract (27 đạt).
5. **QueryClient băm khóa bằng hàm của wagmi** (`web/app/providers.js`). Sửa lỗi trang trắng "Do not know how to serialize a BigInt" do react-query 5.59.
6. **Ô "phút" cho phép số lẻ** (tối thiểu 0.1 phút) để demo nhanh.
7. **Test E2E dùng ví giả** chuyển lệnh sang node Hardhat (tài khoản mở sẵn), chạy Edge cài sẵn qua `playwright-core`. Không tự động hóa MetaMask thật (Synpress) vì nặng và hay vỡ.
8. Mỗi dòng JavaScript có comment. Riêng các dòng giao diện JSX không comment từng dòng vì làm mã khó đọc, chỉ comment theo khối.
9. Thông số POT ở frontend giả định 18 chữ số thập phân (chưa xác minh, giống phần contract).

Đã kiểm tra: `npm run build` đạt; `npm run test:e2e` đạt toàn luồng (kết nối, tạo, cược, cọc, hết cửa sổ, chốt, nhận 0.7).

Chưa kiểm tra: MetaMask thật bấm tay (bạn cần thử), trạng thái "từ chối ký" trên ví thật, chạy trên testnet.

### Video demo trên testnet (23/10)

- Kịch bản tự động `web/e2e/record-demo.js` (`npm run record` trong `web/`) mở web app trỏ vào testnet, bấm từng bước, quay video 1280x720 có phụ đề, lưu ở `web/e2e/video/` (không commit, 5.5 MB). Video hiện tại dài 2 phút 13 giây.
- Ví trong video là ví tự động ký bằng khóa trong `.env`, không phải MetaMask thật. Phụ đề đầu video có nói rõ. Cần bạn thử MetaMask thật bấm tay một lần để chắc hộp thoại ký hoạt động.
- Mỗi lần quay tốn khoảng 10 tPOT (tạo thị trường mới ghi thêm dữ liệu).

### Hiện tượng cần bạn quyết có sửa không (đã thấy, chưa sửa)

1. **Ô nhập tiền bị đặt lại về 0.01** (thấy khi quay video). ĐÃ SỬA (25/10). Nguyên nhân gốc: danh sách thị trường đọc theo `ids` đảo ngược (mới nhất trước); khi có thị trường mới `ids` đổi, dữ liệu cũ tạm biến mất, mọi thẻ bị gỡ rồi dựng lại nên mất số đang gõ và dòng trạng thái giao dịch. Sửa: đọc id tăng dần, `placeholderData: keepPreviousData`, hiển thị đảo ngược.
2. **Bấm cược trong vài giây cuối hạn cược có thể bị từ chối** ("Betting is closed"). Lưu ý: ghi chú cũ của mình nói giao diện báo "ended" sớm là SAI, chưa được chứng minh. Nguyên nhân thật: contract kiểm tra giờ của block chứa giao dịch, block đó đến sau lúc bấm vài giây. ĐÃ GIẢM THIỂU: khóa nút cược khi còn dưới 10 giây và hiện cảnh báo. Không tránh hẳn được do là tính chất của chuỗi.
3. **Node RPC testnet đôi khi trả "An unknown RPC error occurred"** (gặp 1 trong 5 lần quay). Chạy lại thì đạt. Chưa xử lý.

### Lỗi chập chờn đã thấy

- Lần chạy `npm test` đầu tiên ngay sau khi sửa contract hoặc `hardhat.config.js` từng báo hàng loạt lỗi `Invalid Chai property: changeEtherBalance`. Chạy lại thì đạt 27/27 (thử nhiều lần). Chưa rõ nguyên nhân, nghi do lần biên dịch lại. Nếu gặp: chạy lại `npm test`.

### CHƯA làm

- Chưa deploy testnet (chờ token test về địa chỉ 0x).

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
