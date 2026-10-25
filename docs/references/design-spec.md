# Đặc tả thiết kế Bond Market

## Ý tưởng

Lấy mô hình thị trường dự đoán Yes/No kiểu Polymarket (ai cũng tạo câu hỏi, cược vào một phe, phe đúng chia tiền phe sai), tự viết lại contract từ đầu và thay phần khó nhất: cách biết kết quả thật. Contract không copy code của dapp nào. Chỉ dùng OpenZeppelin (MIT) cho `ReentrancyGuard`, khai báo trong README.

## Vấn đề của thị trường dự đoán

Blockchain không tự biết "mai có mưa không". Phải có ai đó báo kết quả, và người báo có thể gian lận. Các cách hiện có:

- Oracle (dịch vụ ngoài báo kết quả): tốn phí, phụ thuộc bên thứ ba.
- Người tạo thị trường báo, chủ contract xử tranh chấp (như repo wager): phải tin chủ contract.

## Cải tiến: kết quả chốt bằng đấu cọc

Không oracle, không chủ contract, không trọng tài. Sau hạn cược, ai cũng đặt cọc cho Yes hoặc No trong một cửa sổ thời gian. Hết cửa sổ, phe có tổng cọc lớn hơn thắng. Cọc phe thua chia cho cọc phe thắng. Báo sai nghĩa là có người có lợi khi cọc đáp trả, và người báo sai mất tiền.

## Vòng đời của một thị trường

1. `createMarket(question, bettingEndsAt)`: tạo câu hỏi và hạn cược. Người tạo không có quyền gì thêm.
2. `bet(id, yes)`: cược Yes hoặc No bằng tiền gốc, trước hạn cược.
3. `postBond(id, yes)`: sau hạn cược, đặt cọc cho một phe. Cọc đầu tiên mở cửa sổ phán quyết dài `resolutionWindow` giây. Cọc thêm được trong cửa sổ, có thể đặt nhiều lần cho cả hai phe. **Chống cọc phút chót:** nếu cửa sổ còn ít hơn một phần tư (`resolutionWindow / 4`) khi có cọc mới, hạn chốt dời thành lúc đặt cọc cộng một phần tư. Cọc sớm thì không đổi hạn.
4. `finalize(id)` hoặc `claim(id)`: sau khi hết cửa sổ, chốt kết quả. `claim` tự chốt nếu chưa ai chốt.
5. `claim(id)`: nhận tiền.

## Kết quả và cách chia tiền

| Kết quả | Khi nào | Người cược | Người cọc |
|---|---|---|---|
| Yes hoặc No | Tổng cọc một phe lớn hơn hẳn | Phe thắng chia cả quỹ cược theo tỉ lệ | Phe thắng chia cả quỹ cọc theo tỉ lệ |
| Invalid | Hòa cọc, hoặc 7 ngày sau hạn cược không ai cọc | Hoàn lại nguyên tiền cược | Hoàn lại nguyên tiền cọc |

Công thức cho người ở phe thắng:

- Tiền cược nhận = `cược của mình x (poolYes + poolNo) / pool phe thắng`
- Tiền cọc nhận = `cọc của mình x (bondYes + bondNo) / bond phe thắng`

Trường hợp đặc biệt: nếu không ai cược phe thắng thì hoàn tiền cược cho mọi người. Phần lẻ do làm tròn nằm lại trong contract (vài wei).

## Tham số

| Tham số | Giá trị | Nơi đặt |
|---|---|---|
| Độ dài cửa sổ phán quyết | 60 giây khi demo, nên 24 giờ khi thật (tối thiểu 4 giây) | tham số constructor `resolutionWindow` |
| Thời gian gia hạn khi có cọc phút chót | `resolutionWindow / 4` | tính trong constructor |
| Thời gian chờ hoàn tiền khi không ai cọc | 7 ngày | hằng số `NO_BOND_REFUND_DELAY` |
| Phí nền tảng | 0 | không có |

## Ví dụ số

An cược Yes 1, Bình cược No 3 (quỹ cược 4). Sau hạn cược, Chi cọc Yes 5, Dũng cọc No 2 (quỹ cọc 7). Hết cửa sổ, Yes thắng:

- An nhận 4 (đúng cả quỹ cược vì là người Yes duy nhất), Chi nhận 7 (đúng cả quỹ cọc).
- Bình và Dũng không nhận gì.
- Nếu Dũng tăng cọc No lên 6 trước khi hết cửa sổ thì No thắng.

## Bảo mật cơ bản

- Cập nhật số liệu trước khi gửi tiền, `claim` có `nonReentrant` và cờ `claimed`.
- Chỉ 5 hàm ghi: `createMarket`, `bet`, `postBond`, `finalize`, `claim`. Không hàm admin (có test kiểm tra).

## Hạn chế đã biết

- Người có nhiều tiền áp đảo được cuộc đấu cọc. Cái giá là phải cọc nhiều hơn tất cả phe còn lại cộng lại.
- Gia hạn cửa sổ cần tiền cọc mới, nên người nhiều tiền vẫn có thể liên tục cọc lớn hơn. Sức mạnh phòng thủ là số tiền cọc, không phải luật.
- Giá cố định theo chia quỹ (parimutuel), không có giá thay đổi liên tục như Polymarket thật.
- Contract không kiểm tra câu hỏi có rõ ràng hay kết quả có đúng sự thật không.

## Chưa làm (cố ý, tránh over-engineering)

- Phí nền tảng, hàm admin, tạm dừng, nâng cấp contract.
- Sổ lệnh hoặc AMM, bán lại vị thế trước khi chốt.
- Phân trang danh sách thị trường (frontend hiện đọc hết trong một lần gọi).
