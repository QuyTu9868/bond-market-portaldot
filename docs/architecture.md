# Architecture

Sơ đồ dùng Mermaid, GitHub hiển thị trực tiếp. Dùng nguyên cho hồ sơ check-in (hoặc chụp ảnh sơ đồ).

## Các thành phần

```mermaid
flowchart LR
    U[User with wallet] -->|createMarket, bet, postBond, finalize, claim| M[PredictionMarket contract]
    S[Scripts: check-network, deploy, demo] -->|ethers.js over RPC| M
    F[Web app in web/, Next.js] -->|wagmi / viem| M
    M -->|reads block.timestamp| C[Portaldot V3 EVM testnet]
    U -->|MetaMask, chain ID 420420777| C
```

Chỉ có một contract chạy trên chuỗi: `PredictionMarket`, giữ mọi thị trường và tiền. Script chạy ngoài chuỗi để deploy và demo. Frontend Next.js nằm trong `web/`, đọc và ghi trực tiếp vào contract qua ví người dùng.

## Trạng thái của một thị trường

```mermaid
stateDiagram-v2
    [*] --> Betting: createMarket
    Betting --> Betting: bet
    Betting --> Bonding: first postBond after betting ends
    Bonding --> Bonding: postBond, window still open
    Bonding --> Yes: window over, bondYes greater
    Bonding --> No: window over, bondNo greater
    Bonding --> Invalid: window over, bonds tie
    Betting --> Invalid: 7 days after betting ends, no bond
    Yes --> [*]: claim
    No --> [*]: claim
    Invalid --> [*]: claim, refund
```

## Luồng một thị trường từ đầu đến cuối

```mermaid
sequenceDiagram
    participant C as Creator
    participant B as Bettors
    participant R as Resolvers
    participant M as PredictionMarket
    C->>M: createMarket(question, bettingEndsAt)
    B->>M: bet(id, yes) + native token
    Note over M: betting ends
    R->>M: postBond(id, yes) + native token, opens window
    R->>M: more postBond(id, yes or no), anyone can outbid
    Note over M: window over
    B->>M: claim(id), contract finalizes if needed
    R->>M: claim(id)
    M-->>B: winners share the bet pool
    M-->>R: winners share the bond pool
```

`claim` có `nonReentrant`, đánh dấu `claimed` trước khi gửi tiền.

## Dữ liệu lưu trên chuỗi

Mỗi thị trường (struct `Market`):

| Trường | Ý nghĩa |
|---|---|
| question, creator | Câu hỏi và người tạo (địa chỉ khác 0 nghĩa là tồn tại) |
| bettingEndsAt | Hết giờ này ngừng cược, bắt đầu cho cọc |
| windowEnd | Hết giờ này chốt kết quả, bằng 0 nếu chưa ai cọc |
| poolYes, poolNo | Tổng tiền cược mỗi phe |
| bondYes, bondNo | Tổng tiền cọc mỗi phe |
| result | Pending, Yes, No hoặc Invalid |

Mỗi người trong mỗi thị trường (struct `Position`): `betYes`, `betNo`, `bondYes`, `bondNo`, `claimed`.
