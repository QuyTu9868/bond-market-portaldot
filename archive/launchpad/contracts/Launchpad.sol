// SPDX-License-Identifier: MIT
// Giấy phép mã nguồn mở MIT
pragma solidity ^0.8.24; // Phiên bản trình biên dịch

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // Giao diện chuẩn của token ERC20 để gọi transfer
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // Chống tấn công gọi lại hàm khi đang xử lý tiền
import {LaunchToken} from "./LaunchToken.sol"; // Token mà Launchpad sẽ tạo ra

/// @title Launchpad
/// @notice Nơi ai cũng tạo được token meme và mua bán ngay trên đường giá tự động (bonding curve).
/// Hai cải tiến so với kiểu pump.fun:
/// 1) Phí chống bot: phí mua cao ở lúc mới ra mắt rồi giảm dần về 0, bot mua đầu phải trả phí cắt cổ.
/// 2) Phí của người tạo chốt cứng từ lúc ra mắt, không có hàm nào sửa được sau đó (chặn kiểu đổi phí để rút tiền).
contract Launchpad is ReentrancyGuard {
    uint256 public constant BPS = 10_000; // Mẫu số tính phần trăm: 10_000 điểm cơ bản (bps) = 100%
    uint256 public constant MAX_CREATOR_FEE_BPS = 200; // Người tạo được đặt phí tối đa 2%
    uint256 public constant START_SNIPE_FEE_BPS = 5_000; // Phí chống bot lúc mới ra mắt là 50%
    uint256 public constant SNIPE_WINDOW = 300; // Phí chống bot giảm đều về 0 trong 300 giây (5 phút)
    uint256 public constant CURVE_TOKENS = 800_000_000 ether; // Số token bán trên đường giá, 200 triệu còn lại để dành cho thanh khoản sau này
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 1_073_000_000 ether; // Lượng token ảo ban đầu, dùng để tính giá khởi điểm

    address public immutable treasury; // Ví nhận phí chống bot, gán 1 lần lúc deploy
    uint256 public immutable initialVirtualNative; // Lượng tiền ảo ban đầu của đường giá, quyết định giá khởi điểm
    uint256 public immutable graduationNative; // Khi tiền thật trong đường giá đạt mức này thì "tốt nghiệp"

    struct Curve { // Dữ liệu của mỗi token đang giao dịch
        address creator; // Người tạo token, địa chỉ khác 0 nghĩa là token này tồn tại
        uint64 createdAt; // Thời điểm tạo (giây), dùng để tính phí chống bot
        uint16 creatorFeeBps; // Phí của người tạo, chốt cứng lúc tạo
        bool graduated; // Đã đạt mục tiêu chưa, đạt rồi thì ngừng cho mua
        uint256 virtualNative; // Tiền ảo hiện tại (dùng để tính giá)
        uint256 virtualTokens; // Token ảo hiện tại (dùng để tính giá)
        uint256 realNative; // Tiền thật đang nằm trong đường giá
        uint256 realTokensLeft; // Số token còn bán được trên đường giá
        uint256 k; // Hằng số của đường giá: virtualNative nhân virtualTokens luôn giữ nguyên
    }

    mapping(address => Curve) public curves; // Tra dữ liệu đường giá theo địa chỉ token
    mapping(address => uint256) public feesOwed; // Phí mỗi người được nhận, tự rút bằng claimFees
    address[] public allTokens; // Danh sách mọi token đã tạo, để giao diện liệt kê

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint16 creatorFeeBps); // Báo token mới ra mắt
    event Bought(address indexed token, address indexed buyer, uint256 nativeIn, uint256 tokensOut, uint256 snipeFee, uint256 creatorFee); // Báo có người mua
    event Sold(address indexed token, address indexed seller, uint256 tokensIn, uint256 nativeOut, uint256 creatorFee); // Báo có người bán
    event Graduated(address indexed token, uint256 realNative); // Báo token đã đạt mục tiêu
    event FeesClaimed(address indexed account, uint256 amount); // Báo có người rút phí

    constructor(uint256 initialVirtualNative_, uint256 graduationNative_) { // Chạy 1 lần lúc deploy
        require(initialVirtualNative_ > 0, "Initial virtual native is zero"); // Tiền ảo ban đầu phải lớn hơn 0 để tính giá được
        require(graduationNative_ > 0, "Graduation target is zero"); // Mục tiêu tốt nghiệp phải lớn hơn 0
        treasury = msg.sender; // Người deploy là ví nhận phí chống bot
        initialVirtualNative = initialVirtualNative_; // Lưu tiền ảo ban đầu
        graduationNative = graduationNative_; // Lưu mục tiêu tốt nghiệp
    }

    /// @notice Tạo token mới. Phí người tạo chốt cứng ở bước này.
    function createToken(string calldata name, string calldata symbol, uint16 creatorFeeBps) external returns (address token) { // Ai cũng gọi được
        require(creatorFeeBps <= MAX_CREATOR_FEE_BPS, "Creator fee above max"); // Không cho đặt phí cao hơn 2%
        token = address(new LaunchToken(name, symbol, address(this))); // Tạo token mới, toàn bộ nguồn cung về Launchpad
        curves[token] = Curve({ // Ghi dữ liệu đường giá cho token này
            creator: msg.sender, // Người gọi hàm là người tạo
            createdAt: uint64(block.timestamp), // Ghi lại thời điểm tạo
            creatorFeeBps: creatorFeeBps, // Chốt phí người tạo, không có hàm nào sửa được sau này
            graduated: false, // Mới tạo nên chưa tốt nghiệp
            virtualNative: initialVirtualNative, // Bắt đầu với tiền ảo ban đầu
            virtualTokens: INITIAL_VIRTUAL_TOKENS, // Bắt đầu với token ảo ban đầu
            realNative: 0, // Chưa có ai mua nên tiền thật bằng 0
            realTokensLeft: CURVE_TOKENS, // Còn nguyên số token bán trên đường giá
            k: initialVirtualNative * INITIAL_VIRTUAL_TOKENS // Hằng số đường giá
        }); // Kết thúc ghi dữ liệu
        allTokens.push(token); // Thêm vào danh sách để giao diện liệt kê
        emit TokenCreated(token, msg.sender, name, symbol, creatorFeeBps); // Phát sự kiện
    }

    /// @notice Phí chống bot hiện tại của một token, tính bằng bps. Giảm đều từ 50% về 0 trong 5 phút đầu.
    function currentSnipeFeeBps(address token) public view returns (uint256) { // Ai cũng xem được
        Curve storage c = curves[token]; // Lấy dữ liệu đường giá
        require(c.creator != address(0), "Unknown token"); // Token phải tồn tại
        uint256 elapsed = block.timestamp - c.createdAt; // Đã trôi qua bao nhiêu giây kể từ lúc tạo
        if (elapsed >= SNIPE_WINDOW) return 0; // Hết 5 phút thì không còn phí chống bot
        return (START_SNIPE_FEE_BPS * (SNIPE_WINDOW - elapsed)) / SNIPE_WINDOW; // Giảm đều theo thời gian còn lại
    }

    /// @notice Tính trước một lệnh mua sẽ nhận bao nhiêu token và mất bao nhiêu phí. Không tốn gas khi gọi từ ngoài.
    function quoteBuy(address token, uint256 nativeIn) external view returns (uint256 tokensOut, uint256 snipeFee, uint256 creatorFee) { // Ai cũng xem được
        Curve storage c = curves[token]; // Lấy dữ liệu đường giá
        require(c.creator != address(0), "Unknown token"); // Token phải tồn tại
        snipeFee = (nativeIn * currentSnipeFeeBps(token)) / BPS; // Phí chống bot trên số tiền mua
        creatorFee = (nativeIn * c.creatorFeeBps) / BPS; // Phí người tạo trên số tiền mua
        uint256 net = nativeIn - snipeFee - creatorFee; // Số tiền thật sự đi vào đường giá sau khi trừ phí
        uint256 newVirtualNative = c.virtualNative + net; // Tiền ảo sau khi mua
        uint256 newVirtualTokens = _ceilDiv(c.k, newVirtualNative); // Token ảo sau khi mua (làm tròn lên để có lợi cho đường giá)
        tokensOut = c.virtualTokens - newVirtualTokens; // Số token người mua nhận được
    }

    /// @notice Mua token bằng tiền gốc của mạng (gửi kèm trong giao dịch).
    function buy(address token, uint256 minTokensOut) external payable nonReentrant { // nonReentrant chặn gọi lại khi đang chạy
        Curve storage c = curves[token]; // Lấy dữ liệu đường giá
        require(c.creator != address(0), "Unknown token"); // Token phải tồn tại
        require(!c.graduated, "Curve already graduated"); // Đã tốt nghiệp thì ngừng cho mua
        require(msg.value > 0, "Send some native token"); // Phải gửi kèm tiền

        uint256 snipeFee = (msg.value * currentSnipeFeeBps(token)) / BPS; // Phí chống bot lúc này
        uint256 creatorFee = (msg.value * c.creatorFeeBps) / BPS; // Phí người tạo (chốt cứng)
        uint256 net = msg.value - snipeFee - creatorFee; // Tiền thật sự đi vào đường giá

        uint256 newVirtualNative = c.virtualNative + net; // Tiền ảo sau khi mua
        uint256 newVirtualTokens = _ceilDiv(c.k, newVirtualNative); // Token ảo sau khi mua
        uint256 tokensOut = c.virtualTokens - newVirtualTokens; // Số token người mua nhận
        require(tokensOut > 0, "Amount too small"); // Mua quá ít, không nhận được token nào
        require(tokensOut >= minTokensOut, "Slippage: got fewer tokens than minimum"); // Bảo vệ người mua khi giá nhảy
        require(tokensOut <= c.realTokensLeft, "Exceeds curve cap, buy less"); // Không bán quá số token trên đường giá

        c.virtualNative = newVirtualNative; // Cập nhật tiền ảo
        c.virtualTokens = newVirtualTokens; // Cập nhật token ảo
        c.realNative += net; // Cộng tiền thật vào đường giá
        c.realTokensLeft -= tokensOut; // Trừ số token còn bán được
        feesOwed[treasury] += snipeFee; // Ghi sổ phí chống bot cho ví treasury
        feesOwed[c.creator] += creatorFee; // Ghi sổ phí cho người tạo

        if (c.realNative >= graduationNative) { // Nếu đạt mục tiêu
            c.graduated = true; // Đánh dấu đã tốt nghiệp, từ giờ chỉ còn bán được
            emit Graduated(token, c.realNative); // Phát sự kiện
        } // Hết khối kiểm tra mục tiêu

        require(IERC20(token).transfer(msg.sender, tokensOut), "Token transfer failed"); // Gửi token cho người mua (làm sau cùng cho an toàn)
        emit Bought(token, msg.sender, msg.value, tokensOut, snipeFee, creatorFee); // Phát sự kiện
    }

    /// @notice Bán token lấy lại tiền. Cần approve token cho Launchpad trước. Vẫn bán được sau khi đã tốt nghiệp.
    function sell(address token, uint256 tokenAmount, uint256 minNativeOut) external nonReentrant { // nonReentrant chặn gọi lại
        Curve storage c = curves[token]; // Lấy dữ liệu đường giá
        require(c.creator != address(0), "Unknown token"); // Token phải tồn tại
        require(tokenAmount > 0, "Amount is zero"); // Phải bán số lượng lớn hơn 0

        uint256 newVirtualTokens = c.virtualTokens + tokenAmount; // Token ảo sau khi bán
        uint256 newVirtualNative = _ceilDiv(c.k, newVirtualTokens); // Tiền ảo sau khi bán (làm tròn lên có lợi cho đường giá)
        uint256 gross = c.virtualNative - newVirtualNative; // Tiền trả ra trước khi trừ phí
        require(gross <= c.realNative, "Not enough reserve"); // Đường giá phải đủ tiền thật để trả
        uint256 creatorFee = (gross * c.creatorFeeBps) / BPS; // Phí người tạo (chốt cứng)
        uint256 payout = gross - creatorFee; // Số tiền người bán nhận
        require(payout >= minNativeOut, "Slippage: got less than minimum"); // Bảo vệ người bán khi giá nhảy

        c.virtualTokens = newVirtualTokens; // Cập nhật token ảo
        c.virtualNative = newVirtualNative; // Cập nhật tiền ảo
        c.realNative -= gross; // Trừ tiền thật khỏi đường giá
        c.realTokensLeft += tokenAmount; // Cộng lại số token còn bán được
        feesOwed[c.creator] += creatorFee; // Ghi sổ phí cho người tạo

        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed"); // Thu token từ người bán (cần approve trước)
        (bool ok, ) = msg.sender.call{value: payout}(""); // Gửi tiền cho người bán
        require(ok, "Payout failed"); // Gửi tiền thất bại thì hủy cả giao dịch
        emit Sold(token, msg.sender, tokenAmount, payout, creatorFee); // Phát sự kiện
    }

    /// @notice Rút phí mình được nhận (người tạo hoặc treasury).
    function claimFees() external nonReentrant { // nonReentrant chặn gọi lại
        uint256 amount = feesOwed[msg.sender]; // Số phí đang được nhận
        require(amount > 0, "No fees to claim"); // Không có gì để rút
        feesOwed[msg.sender] = 0; // Đưa về 0 TRƯỚC khi gửi tiền để chống rút lặp
        (bool ok, ) = msg.sender.call{value: amount}(""); // Gửi tiền
        require(ok, "Fee payout failed"); // Gửi thất bại thì hủy
        emit FeesClaimed(msg.sender, amount); // Phát sự kiện
    }

    /// @notice Số token đã tạo, để giao diện biết cần lặp bao nhiêu lần.
    function tokenCount() external view returns (uint256) { // Ai cũng xem được
        return allTokens.length; // Trả về độ dài danh sách
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) { // Phép chia làm tròn lên, chỉ dùng nội bộ
        return (a + b - 1) / b; // Cộng thêm (b - 1) rồi chia thường sẽ ra kết quả làm tròn lên
    }
}
