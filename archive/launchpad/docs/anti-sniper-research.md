# Nghiên cứu: điểm yếu của launchpad kiểu pump.fun

Đọc ngày 22/10/2026. Các con số trong bài phân tích là ước tính, chưa có kiểm chứng độc lập. Khi viết README, pitch deck hoặc bài X, ghi rõ là "ước tính" và dẫn nguồn.

## Điểm yếu đã ghi nhận

1. **Rug pull và token bị bỏ.** Bài của BlockEden ước tính 98,6% trong 11,9 triệu token đã tạo bị bỏ hoặc rug. Báo Defiant dẫn báo cáo của Solidus Labs nói 99% lượt ra mắt trên pump.fun là pump-and-dump hoặc rug pull. Trong bài Defiant có nêu rug pull trung vị trên Raydium khoảng 2.800 USD. Cả hai chỉ là ước tính.
2. **Sniper bot.** Bot mua 10 đến 20% nguồn cung ở giá gốc ngay lúc ra mắt, bán khi người thật mua làm giá tăng.
3. **Người tạo đổi phí sau ra mắt.** Gọi là "vamping": đổi cấu trúc phí để rút thanh khoản rồi bỏ đi. Pump.fun phản ứng vào tháng 3/2026 bằng cách giới hạn chỉ được sửa phí 1 lần sau ra mắt.
4. **Ngưỡng tốt nghiệp yếu.** Mốc vốn hoá 69.000 USD có thể bị cá voi đẩy qua trong vài phút. Tỉ lệ tốt nghiệp chỉ ở mức vài phần trăm.

## Cách các launchpad mới giải quyết (tham khảo)

- Fair Launch Shield của pump.fun: cửa sổ ra mắt có CAPTCHA và cài đặt chống bot, bắt ví sniper trả giá cao hơn.
- LetsBonk.fun: ví đã xác minh và có lịch sử giao dịch được ưu tiên, người tạo được chia doanh thu đường giá.
- Tốt nghiệp theo thời gian: yêu cầu giao dịch bền vững trong một khoảng thời gian thay vì chạm ngưỡng vốn hoá trong 30 giây.
- Điểm uy tín người tạo on-chain: bài ghi nhận vấn đề Sybil (tạo nhiều ví để làm giả điểm) vẫn chưa giải quyết.

## Dự án này chọn gì

Chọn hai cải tiến chống lại điểm yếu số 2 và số 3: phí chống bot giảm dần và phí người tạo chốt cứng. Hai việc này làm được hoàn toàn trong contract, không cần dịch vụ ngoài. Điểm yếu số 1 và số 4 chỉ giảm được một phần, không giải quyết hết. Không nên tuyên bố là chặn được rug pull.

## Nguồn

- BlockEden, Meme Launchpad 2.0: https://blockeden.xyz/blog/2026/04/20/meme-launchpad-2-pump-fun-letsbonk-anti-sniper-reputation/
- The Defiant: https://thedefiant.io/news/defi/alarming-99-of-memecoin-launches-on-pumpfun-are-pump-and-dumps-or-rug-pulls-report
