import { parseAbi } from "viem"; // Đọc ABI dạng chữ cho gọn

export const marketAbi = parseAbi([ // Chỉ gồm các hàm frontend dùng, khớp contracts/PredictionMarket.sol
  "function createMarket(string question, uint64 bettingEndsAt) returns (uint256)", // Tạo thị trường
  "function bet(uint256 id, bool yes) payable", // Cược Yes hoặc No
  "function postBond(uint256 id, bool yes) payable", // Đặt cọc phán quyết
  "function finalize(uint256 id)", // Chốt kết quả
  "function claim(uint256 id)", // Nhận tiền
  "function marketCount() view returns (uint256)", // Số thị trường
  "function markets(uint256) view returns (string question, address creator, uint64 bettingEndsAt, uint64 windowEnd, uint256 poolYes, uint256 poolNo, uint256 bondYes, uint256 bondNo, uint8 result)", // Dữ liệu một thị trường
  "function positions(uint256, address) view returns (uint256 betYes, uint256 betNo, uint256 bondYes, uint256 bondNo, bool claimed)", // Phần của một người trong một thị trường
  "function NO_BOND_REFUND_DELAY() view returns (uint256)", // Số giây chờ trước khi hoàn tiền nếu không ai cọc
  "error QuestionEmpty()", "error BetEndInPast()", "error UnknownMarket()", "error BettingClosed()", "error BettingStillOpen()", "error ZeroValue()", "error AlreadyFinalized()", "error WindowOver()", "error WindowNotOver()", "error NoBondYet()", "error AlreadyClaimed()", "error NothingToClaim()", "error PayoutFailed()", // Các lỗi của contract, để viem đọc được tên lỗi khi giao dịch bị từ chối
]);

export const RESULT_LABELS = ["Pending", "Yes", "No", "Invalid (refund)"]; // Tên kết quả theo thứ tự enum Result trong contract

const FRIENDLY_ERRORS = { // Đổi tên lỗi của contract thành câu dễ hiểu
  BettingClosed: "Betting has ended for this market.", // Hết hạn cược
  BettingStillOpen: "Betting is still open, bonds can start after it ends.", // Chưa tới lúc cọc
  WindowOver: "The resolution window is over, nobody can add bonds now.", // Hết cửa sổ
  WindowNotOver: "The resolution window is not over yet.", // Chưa chốt được
  NoBondYet: "Nobody posted a bond yet. Refund opens 7 days after betting ends.", // Chưa ai cọc
  AlreadyFinalized: "This market is already finalized.", // Đã chốt
  AlreadyClaimed: "You already claimed.", // Đã nhận
  NothingToClaim: "You have nothing to claim on this market.", // Không có gì để nhận
  ZeroValue: "Enter an amount above zero.", // Thiếu tiền
  QuestionEmpty: "Write a question first.", // Câu hỏi trống
  BetEndInPast: "The betting end time must be in the future.", // Hạn cược sai
  UnknownMarket: "This market does not exist.", // Không có thị trường
  PayoutFailed: "The payout transfer failed.", // Gửi tiền thất bại
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
