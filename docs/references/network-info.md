# Thông tin mạng Portaldot

Mỗi mục ghi rõ nguồn và độ chắc chắn. Mục nào đánh dấu "chưa xác minh" thì kiểm tra trước khi dựa vào.

## Testnet V3 (EVM)

| Thông tin | Giá trị | Nguồn | Độ chắc chắn |
|---|---|---|---|
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` | Trang hackathon, 20/10 | Cần kiểm tra lại, ban tổ chức từng đổi endpoint |
| Chain ID (EVM) | 420420777 | Trang hackathon, 20/10 | Cần kiểm tra lại |
| Node (WebSocket) | `wss://test-node-v3.portaldot.dev` | Trang hackathon, 20/10 | Cần kiểm tra lại |
| Node explorer | https://node-console.portaldot.dev/ | Trang hackathon, 20/10 | Cần kiểm tra lại |

Cách kiểm tra nhanh: chạy `npm run check:network`, lệnh này in chain ID và số block thực tế của RPC.

## Địa chỉ ví

- Địa chỉ POT gốc dạng SS58, bắt đầu bằng số 5. Mạng dùng định dạng SS58 số 42 (nguồn: trang chain-info của tài liệu Portaldot). Token test được phát về loại địa chỉ này.
- Địa chỉ EVM dạng 0x dùng với MetaMask và contract Solidity.
- Chưa xác minh: hai loại địa chỉ có liên thông (map) với nhau không, và token test ở địa chỉ số 5 có dùng được ở địa chỉ 0x không. Nếu `npm run check:network` báo số dư 0 thì hỏi admin.
- Form đăng ký hackathon trên DoraHacks ghi trang tạo ví: https://www.portaldot.world

## Token

- Token gốc là POT. Tài liệu mainnet ghi 14 chữ số thập phân ở lớp Substrate.
- Chưa xác minh số chữ số thập phân ở lớp EVM (thường là 18). Script và test giả định 18. Nếu số dư hiển thị sai bậc, báo lại để sửa.

## Nhận token test

- Điền địa chỉ ví POT gốc ở form đăng ký DoraHacks, hoặc mở ticket trên Discord Portaldot kèm ảnh chụp đăng ký.
- Chưa nhận được thì nhắn admin: DoraHacks @Stella707827, Discord @titus242471 (theo thông báo trên trang hackathon). Cung cấp địa chỉ SS58 bắt đầu bằng số 5.
- Admin KHÔNG BAO GIỜ hỏi seed phrase hay private key. Ai hỏi thì là lừa đảo.

## Liên kết

- Discord: https://discord.gg/portaldot
- Trang hackathon: https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail
- Tài liệu dev: https://portaldot-dev.readthedocs.io/en/latest/Introduction.html (bản này không nhắc EVM, mô tả mạng khá khác trang hackathon, coi chừng lỗi thời)

## Ghi chú về bộ lệnh EVM

`hardhat.config.js` đặt `evmVersion: "paris"` để tránh lệnh PUSH0 (có từ bản Shanghai). Một số mạng Substrate EVM chưa hỗ trợ lệnh này nên contract biên dịch mới sẽ deploy lỗi. Nếu CP0 deploy lỗi lạ, đây là chỗ đầu tiên cần xem.
