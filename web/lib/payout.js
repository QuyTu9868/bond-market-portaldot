// Tính số tiền một người nhận được, giống hệt hàm _payout trong contracts/PredictionMarket.sol (contract không còn hàm xem trước).
// market: mảng từ markets(id); position: mảng từ positions(id, user). Dùng BigInt nên chia như contract (làm tròn xuống).
export function computePayout(market, position) {
  const [, , , , poolYes, poolNo, bondYes, bondNo, result] = market; // Tách các trường cần dùng
  const [betYes, betNo, userBondYes, userBondNo, claimed] = position; // Phần của người dùng
  if (claimed) return 0n; // Đã nhận rồi thì không còn gì
  let outcome = result; // Kết quả thật nếu đã chốt
  if (outcome === 0) { // Chưa chốt thì tính thử theo cọc hiện tại
    if (bondYes === bondNo) return 0n; // Hòa cọc hoặc chưa ai cọc: chưa có kết quả để tính
    outcome = bondYes > bondNo ? 1 : 2; // Giả sử chốt theo phe đang dẫn
  }
  if (outcome === 3) return betYes + betNo + userBondYes + userBondNo; // Hòa cọc: hoàn lại nguyên tiền cược và cọc
  const yesWins = outcome === 1; // Phe thắng là Yes hay No
  const winPool = yesWins ? poolYes : poolNo; // Quỹ cược phe thắng
  const winBond = yesWins ? bondYes : bondNo; // Tổng cọc phe thắng
  let amount = 0n; // Tiền nhận
  if (winPool === 0n) amount = betYes + betNo; // Không ai cược phe thắng: hoàn tiền cược
  else amount = ((yesWins ? betYes : betNo) * (poolYes + poolNo)) / winPool; // Phần của mình trong tổng quỹ cược
  amount += ((yesWins ? userBondYes : userBondNo) * (bondYes + bondNo)) / winBond; // Phần của mình trong tổng cọc
  return amount; // Trả kết quả
}
