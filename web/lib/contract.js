import { parseAbi } from "viem"; // Đọc ABI dạng chữ cho gọn

export const marketAbi = parseAbi([ // Chỉ gồm các hàm frontend dùng, khớp contracts/PredictionMarket.sol
  "function createMarket(string question, uint64 bettingEndsAt) returns (uint256)", // Tạo thị trường
  "function bet(uint256 id, bool yes) payable", // Cược Yes hoặc No
  "function postBond(uint256 id, bool yes) payable", // Đặt cọc phán quyết
  "function finalize(uint256 id)", // Chốt kết quả
  "function claim(uint256 id)", // Nhận tiền
  "function marketCount() view returns (uint256)", // Số thị trường
  "function markets(uint256) view returns (string question, address creator, uint64 bettingEndsAt, uint64 windowEnd, uint256 poolYes, uint256 poolNo, uint256 bondYes, uint256 bondNo, uint8 result)", // Dữ liệu một thị trường
  "function previewPayout(uint256 id, address user) view returns (uint256)", // Số tiền sẽ nhận
  "function NO_BOND_REFUND_DELAY() view returns (uint256)", // Số giây chờ trước khi hoàn tiền nếu không ai cọc
]);

export const RESULT_LABELS = ["Pending", "Yes", "No", "Invalid (refund)"]; // Tên kết quả theo thứ tự enum Result trong contract

const FRIENDLY_ERRORS = { // Đổi lý do revert của contract thành câu dễ hiểu
  "Betting is closed": "Betting has ended for this market.", // Hết hạn cược
  "Betting is still open": "Betting is still open, bonds can start after it ends.", // Chưa tới lúc cọc
  "Resolution window is over": "The resolution window is over, nobody can add bonds now.", // Hết cửa sổ
  "Resolution window not over": "The resolution window is not over yet.", // Chưa chốt được
  "No bond posted yet": "Nobody posted a bond yet. Refund opens 7 days after betting ends.", // Chưa ai cọc
  "Already finalized": "This market is already finalized.", // Đã chốt
  "Already claimed": "You already claimed.", // Đã nhận
  "Nothing to claim": "You have nothing to claim on this market.", // Không có gì để nhận
  "Send some native token": "Enter an amount above zero.", // Thiếu tiền
  "Question is empty": "Write a question first.", // Câu hỏi trống
  "Betting end is in the past": "The betting end time must be in the future.", // Hạn cược sai
};

export function friendlyError(error) { // Biến lỗi kỹ thuật thành câu cho người dùng
  const text = String(error?.shortMessage || error?.message || error); // Lấy nội dung lỗi
  if (/user rejected|denied|rejected the request/i.test(text)) return "You rejected the request in your wallet."; // Người dùng bấm hủy
  if (/insufficient funds/i.test(text)) return "Not enough balance to pay for this transaction."; // Thiếu tiền
  for (const reason of Object.keys(FRIENDLY_ERRORS)) { // Duyệt từng lý do đã biết
    if (text.includes(reason)) return FRIENDLY_ERRORS[reason]; // Khớp thì trả câu dễ hiểu
  }
  return "Transaction failed: " + text.slice(0, 160); // Lỗi lạ thì hiện đoạn đầu
}
