// SPDX-License-Identifier: MIT
// Giấy phép mã nguồn mở MIT
pragma solidity ^0.8.24; // Phiên bản trình biên dịch

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // Chống tấn công gọi lại hàm khi đang xử lý tiền

/// @title PredictionMarket
/// @notice Thị trường dự đoán Yes/No kiểu Polymarket, cược bằng tiền gốc của mạng.
/// Cải tiến so với Polymarket: kết quả do cuộc đấu cọc quyết định, không cần oracle (nguồn dữ liệu ngoài).
/// Ai cũng đặt cọc được cho phe Yes hoặc No trong cửa sổ phán quyết. Hết cửa sổ, phe có tổng cọc lớn hơn thắng.
/// Cọc phe thua chia cho cọc phe thắng, nên báo sai là mất tiền.
/// Chống cọc phút chót: cọc đặt trong phần tư cuối của cửa sổ sẽ kéo dài cửa sổ thêm một phần tư, để phe kia kịp đáp trả.
contract PredictionMarket is ReentrancyGuard {
    error WindowTooShort(); // Cửa sổ phán quyết phải đủ dài để chia được một phần tư
    error QuestionEmpty(); // Câu hỏi trống
    error BetEndInPast(); // Hạn cược ở quá khứ
    error UnknownMarket(); // Không có thị trường với id này
    error BettingClosed(); // Đã hết hạn cược
    error BettingStillOpen(); // Chưa hết hạn cược nên chưa được cọc
    error ZeroValue(); // Không gửi kèm tiền
    error AlreadyFinalized(); // Thị trường đã chốt
    error WindowOver(); // Hết cửa sổ phán quyết, không cọc thêm
    error WindowNotOver(); // Cửa sổ phán quyết chưa hết, chưa chốt được
    error NoBondYet(); // Chưa ai đặt cọc và chưa đủ 7 ngày để hoàn tiền
    error AlreadyClaimed(); // Đã nhận tiền rồi
    error NothingToClaim(); // Không có gì để nhận
    error PayoutFailed(); // Gửi tiền thất bại

    enum Result { Pending, Yes, No, Invalid } // Kết quả: chưa có, Yes thắng, No thắng, hoặc hòa cọc (hoàn tiền)

    struct Market { // Dữ liệu của mỗi thị trường
        string question; // Câu hỏi Yes/No
        address creator; // Người tạo, địa chỉ khác 0 nghĩa là thị trường tồn tại
        uint64 bettingEndsAt; // Hết giờ này thì ngừng cược và bắt đầu cho đặt cọc phán quyết
        uint64 windowEnd; // Hết giờ này thì chốt kết quả, bằng 0 nếu chưa ai đặt cọc
        uint256 poolYes; // Tổng tiền cược phe Yes
        uint256 poolNo; // Tổng tiền cược phe No
        uint256 bondYes; // Tổng tiền cọc phán quyết cho Yes
        uint256 bondNo; // Tổng tiền cọc phán quyết cho No
        Result result; // Kết quả sau khi chốt
    }

    struct Position { // Phần của mỗi người trong một thị trường
        uint256 betYes; // Tiền người này cược Yes
        uint256 betNo; // Tiền người này cược No
        uint256 bondYes; // Tiền người này cọc cho Yes
        uint256 bondNo; // Tiền người này cọc cho No
        bool claimed; // Đã nhận tiền chưa, chặn nhận hai lần
    }

    uint256 public constant NO_BOND_REFUND_DELAY = 7 days; // Sau hạn cược 7 ngày mà chưa ai đặt cọc thì hoàn tiền cược cho mọi người

    uint256 public immutable resolutionWindow; // Số giây của cửa sổ phán quyết, tính từ lúc có cọc đầu tiên
    uint256 private immutable extension; // Một phần tư cửa sổ: cọc đặt khi cửa sổ còn ít hơn số này sẽ kéo dài cửa sổ tới đúng số này kể từ lúc đặt

    Market[] public markets; // Danh sách mọi thị trường, id là vị trí trong mảng
    mapping(uint256 => mapping(address => Position)) public positions; // Phần của từng người theo từng thị trường

    event MarketCreated(uint256 indexed id, address indexed creator, string question, uint64 bettingEndsAt); // Báo thị trường mới
    event BetPlaced(uint256 indexed id, address indexed user, bool yes, uint256 amount); // Báo có người cược
    event BondPosted(uint256 indexed id, address indexed user, bool yes, uint256 amount, uint64 windowEnd); // Báo có người đặt cọc
    event Finalized(uint256 indexed id, Result result); // Báo đã chốt kết quả
    event Claimed(uint256 indexed id, address indexed user, uint256 amount); // Báo có người nhận tiền

    constructor(uint256 resolutionWindow_) { // Chạy 1 lần lúc deploy
        if (resolutionWindow_ < 4) revert WindowTooShort(); // Cửa sổ phải từ 4 giây trở lên để một phần tư lớn hơn 0
        resolutionWindow = resolutionWindow_; // Lưu độ dài cửa sổ
        extension = resolutionWindow_ / 4; // Lưu thời gian gia hạn
    }

    /// @notice Tạo thị trường mới. Người tạo không có quyền đặc biệt nào sau đó.
    function createMarket(string calldata question, uint64 bettingEndsAt) external returns (uint256 id) { // Ai cũng gọi được
        if (bytes(question).length == 0) revert QuestionEmpty(); // Câu hỏi không được trống
        if (bettingEndsAt <= block.timestamp) revert BetEndInPast(); // Hạn cược phải ở tương lai
        id = markets.length; // Id mới là vị trí tiếp theo trong mảng
        markets.push(Market({ // Thêm thị trường vào danh sách
            question: question, // Câu hỏi
            creator: msg.sender, // Người gọi hàm là người tạo
            bettingEndsAt: bettingEndsAt, // Hạn cược
            windowEnd: 0, // Chưa có cọc nên chưa có hạn chốt
            poolYes: 0, // Chưa có cược
            poolNo: 0, // Chưa có cược
            bondYes: 0, // Chưa có cọc
            bondNo: 0, // Chưa có cọc
            result: Result.Pending // Chưa có kết quả
        })); // Kết thúc thêm
        emit MarketCreated(id, msg.sender, question, bettingEndsAt); // Phát sự kiện
    }

    /// @notice Cược Yes hoặc No bằng tiền gửi kèm. Chỉ cược được trước hạn cược.
    function bet(uint256 id, bool yes) external payable { // Gửi kèm tiền để cược
        Market storage m = _getMarket(id); // Lấy thị trường, báo lỗi nếu không tồn tại
        if (block.timestamp >= m.bettingEndsAt) revert BettingClosed(); // Hết hạn cược thì không cược nữa
        if (msg.value == 0) revert ZeroValue(); // Phải gửi kèm tiền
        Position storage p = positions[id][msg.sender]; // Phần của người gọi
        if (yes) { // Cược Yes
            m.poolYes += msg.value; // Cộng vào quỹ Yes
            p.betYes += msg.value; // Ghi phần của người này
        } else { // Cược No
            m.poolNo += msg.value; // Cộng vào quỹ No
            p.betNo += msg.value; // Ghi phần của người này
        } // Hết rẽ nhánh
        emit BetPlaced(id, msg.sender, yes, msg.value); // Phát sự kiện
    }

    /// @notice Đặt cọc cho phe Yes hoặc No sau hạn cược. Cọc đầu tiên mở cửa sổ phán quyết.
    function postBond(uint256 id, bool yes) external payable { // Gửi kèm tiền để cọc
        Market storage m = _getMarket(id); // Lấy thị trường
        if (block.timestamp < m.bettingEndsAt) revert BettingStillOpen(); // Chưa hết hạn cược thì chưa được cọc
        if (msg.value == 0) revert ZeroValue(); // Phải gửi kèm tiền
        if (m.result != Result.Pending) revert AlreadyFinalized(); // Đã chốt (kể cả hoàn tiền do không ai cọc) thì không cọc nữa
        if (m.windowEnd == 0) { // Đây là cọc đầu tiên
            m.windowEnd = uint64(block.timestamp + resolutionWindow); // Mở cửa sổ phán quyết từ lúc này
        } else { // Đã có cửa sổ
            if (block.timestamp >= m.windowEnd) revert WindowOver(); // Hết cửa sổ thì không cọc thêm
            uint64 minEnd = uint64(block.timestamp + extension); // Cửa sổ phải còn ít nhất chừng này sau cọc này
            if (m.windowEnd < minEnd) m.windowEnd = minEnd; // Cọc phút chót thì kéo dài cửa sổ để phe kia kịp đáp trả
        } // Hết kiểm tra cửa sổ
        Position storage p = positions[id][msg.sender]; // Phần của người gọi
        if (yes) { // Cọc cho Yes
            m.bondYes += msg.value; // Cộng vào tổng cọc Yes
            p.bondYes += msg.value; // Ghi phần của người này
        } else { // Cọc cho No
            m.bondNo += msg.value; // Cộng vào tổng cọc No
            p.bondNo += msg.value; // Ghi phần của người này
        } // Hết rẽ nhánh
        emit BondPosted(id, msg.sender, yes, msg.value, m.windowEnd); // Phát sự kiện
    }

    /// @notice Chốt kết quả sau khi hết cửa sổ phán quyết. Ai cũng gọi được.
    function finalize(uint256 id) external { // Ai cũng gọi được
        _finalize(id, _getMarket(id)); // Chốt, revert nếu chưa tới lúc
    }

    /// @notice Nhận tiền cược và cọc của mình sau khi có kết quả. Tự chốt kết quả nếu chưa ai chốt.
    function claim(uint256 id) external nonReentrant { // nonReentrant chặn gọi lại khi đang gửi tiền
        Market storage m = _getMarket(id); // Lấy thị trường
        _finalize(id, m); // Chốt nếu chưa chốt (revert nếu chưa tới lúc)
        Position storage p = positions[id][msg.sender]; // Phần của người gọi
        if (p.claimed) revert AlreadyClaimed(); // Mỗi người chỉ nhận một lần
        uint256 amount = _payout(m, p); // Tính số tiền được nhận
        if (amount == 0) revert NothingToClaim(); // Phe thua hoặc không tham gia thì không có gì
        p.claimed = true; // Đánh dấu đã nhận TRƯỚC khi gửi tiền để chống nhận lặp
        (bool ok, ) = msg.sender.call{value: amount}(""); // Gửi tiền
        if (!ok) revert PayoutFailed(); // Gửi thất bại thì hủy cả giao dịch
        emit Claimed(id, msg.sender, amount); // Phát sự kiện
    }

    /// @notice Số thị trường đã tạo, để giao diện biết cần lặp bao nhiêu lần.
    function marketCount() external view returns (uint256) { // Ai cũng xem được
        return markets.length; // Trả về độ dài danh sách
    }

    function _getMarket(uint256 id) private view returns (Market storage) { // Lấy thị trường theo id, chỉ dùng nội bộ
        if (id >= markets.length) revert UnknownMarket(); // Id phải tồn tại
        return markets[id]; // Trả về thị trường
    }

    function _finalize(uint256 id, Market storage m) private { // Chốt kết quả, bỏ qua nếu đã chốt
        if (m.result != Result.Pending) return; // Đã chốt rồi thì thôi
        if (m.windowEnd == 0) { // Chưa ai đặt cọc
            if (block.timestamp < m.bettingEndsAt + NO_BOND_REFUND_DELAY) revert NoBondYet(); // Chưa đủ 7 ngày thì chờ tiếp
            m.result = Result.Invalid; // Đủ 7 ngày mà không ai cọc: hoàn tiền cược cho mọi người
            emit Finalized(id, m.result); // Phát sự kiện
            return; // Xong
        } // Hết nhánh không ai cọc
        if (block.timestamp < m.windowEnd) revert WindowNotOver(); // Cửa sổ chưa hết thì chưa chốt được
        if (m.bondYes > m.bondNo) { // Cọc Yes lớn hơn
            m.result = Result.Yes; // Yes thắng
        } else if (m.bondNo > m.bondYes) { // Cọc No lớn hơn
            m.result = Result.No; // No thắng
        } else { // Hòa cọc
            m.result = Result.Invalid; // Hoàn tiền cho mọi người
        } // Hết so sánh
        emit Finalized(id, m.result); // Phát sự kiện
    }

    function _payout(Market memory m, Position memory p) private pure returns (uint256 amount) { // Tính tiền được nhận theo kết quả đã chốt
        if (m.result == Result.Invalid) { // Hòa cọc
            return p.betYes + p.betNo + p.bondYes + p.bondNo; // Trả lại nguyên tiền cược và cọc
        } // Hết nhánh hòa
        bool yesWins = m.result == Result.Yes; // Phe thắng là Yes hay No
        uint256 winPool = yesWins ? m.poolYes : m.poolNo; // Quỹ cược của phe thắng
        uint256 winBond = yesWins ? m.bondYes : m.bondNo; // Tổng cọc của phe thắng
        if (winPool == 0) { // Không ai cược phe thắng
            amount = p.betYes + p.betNo; // Hoàn lại tiền cược cho mọi người
        } else { // Có người cược phe thắng
            amount = (yesWins ? p.betYes : p.betNo) * (m.poolYes + m.poolNo) / winPool; // Phần của mình trong tổng quỹ cược
        } // Hết rẽ nhánh cược
        amount += (yesWins ? p.bondYes : p.bondNo) * (m.bondYes + m.bondNo) / winBond; // Phần của mình trong tổng cọc (cọc phe thua chia cho phe thắng)
    }
}
