# Checklist hồ sơ check-in

Hạn: **19:00 ngày 24/10 giờ Việt Nam** (12:00 UTC). Nên nộp xong trước 12:00 trưa để còn đệm xử lý lỗi nộp bài.

Nộp trên DoraHacks, trang hackathon Portaldot. Ban tổ chức yêu cầu dự án ở bước này đã có bản chạy được, không chỉ là ý tưởng.

## Tiên quyết

- [ ] Đã đăng ký hackathon trên DoraHacks (form hai bước: hồ sơ hacker và câu hỏi của ban tổ chức).
- [ ] Đã có token test (CP0 đạt).

## Hồ sơ cần nộp

- [ ] Tiến độ hiện tại và các việc còn lại (ghi ngắn, trung thực).
- [ ] Link repo GitHub công khai.
- [ ] README đầy đủ (đã có sẵn khung trong `README.md`, điền thêm địa chỉ thật).
- [ ] Lịch sử commit cập nhật liên tục, ít nhất 3 commit trong thời gian thi.
- [ ] Sơ đồ kiến trúc sản phẩm (dùng `docs/architecture.md`, hoặc chụp ảnh sơ đồ).
- [ ] Thông tin triển khai testnet Portaldot:
  - [ ] Địa chỉ contract PredictionMarket (từ `deployments/portaldotTestnet-market.json`)
  - [ ] Mã giao dịch deploy
  - [ ] Link explorer nếu có
  - [ ] Mã giao dịch của bước demo (tạo thị trường, cược, cọc, chốt, nhận tiền) từ `deployments/portaldotTestnet-demo-market.json`
- [ ] Demo ban đầu, chọn một:
  - [ ] Link demo chạy được, hoặc
  - [ ] Video dưới 3 phút cho thấy ít nhất một chức năng lõi

## Gợi ý kịch bản video 3 phút

1. (20 giây) Vấn đề: thị trường dự đoán cần ai đó báo kết quả thật, người báo có thể gian lận hoặc phải tin chủ contract.
2. (20 giây) Giải pháp: kết quả chốt bằng đấu cọc, phe cọc nhiều hơn thắng, không oracle, không admin.
3. (90 giây) Quay màn hình `npm run demo:testnet`: tạo thị trường, cược, đặt cọc, chờ hết cửa sổ, chốt, nhận tiền.
4. (30 giây) Mở transaction hash trên explorer để chứng minh giao dịch thật.
5. (20 giây) Việc tiếp theo: giao diện web, gia hạn cửa sổ khi có cọc phút cuối.

## Sau check-in

- 26/10 có kết quả phản hồi. Cân nhắc đăng ký Office Hour trước 19:00 ngày 27/10 để hỏi admin về EVM, liên thông địa chỉ và DEX trên Portaldot.
