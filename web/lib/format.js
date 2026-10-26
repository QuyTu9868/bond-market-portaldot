import { formatEther } from "viem"; // Đổi wei sang đơn vị tiền

// Hiện số tiền gọn: tối đa 4 chữ số thập phân, bỏ số 0 thừa (0.7000 thành 0.7).
export function fmt(wei) {
  const [whole, fraction = ""] = formatEther(wei).split("."); // Tách phần nguyên và phần thập phân
  const trimmed = fraction.slice(0, 4).replace(/0+$/, ""); // Cắt còn 4 chữ số và bỏ số 0 cuối
  return trimmed ? `${whole}.${trimmed}` : whole; // Ghép lại
}
