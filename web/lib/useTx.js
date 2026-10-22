"use client"; // Chạy ở trình duyệt vì dùng hook của ví

import { useEffect, useState } from "react"; // Hook trạng thái của React
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"; // Gửi giao dịch và chờ xác nhận
import { marketAbi, friendlyError } from "./contract"; // ABI và hàm đổi lỗi
import { marketAddress } from "./config"; // Địa chỉ contract

// Hook gửi một giao dịch và theo dõi 4 trạng thái: signing (chờ ký), confirming (đang xác nhận), success, failed.
export function useTx(onSuccess) {
  const { writeContractAsync } = useWriteContract(); // Hàm gửi giao dịch tới ví
  const [hash, setHash] = useState(); // Mã giao dịch sau khi ký
  const [error, setError] = useState(); // Câu lỗi dễ hiểu
  const [signing, setSigning] = useState(false); // Đang chờ người dùng ký
  const receipt = useWaitForTransactionReceipt({ hash }); // Theo dõi giao dịch đã được xác nhận chưa

  useEffect(() => { // Khi giao dịch xác nhận xong
    if (receipt.isSuccess && onSuccess) onSuccess(); // Báo cho trang tải lại dữ liệu
  }, [receipt.isSuccess]); // Chỉ chạy lại khi trạng thái thành công đổi

  async function send(functionName, args, value) { // Gửi giao dịch gọi một hàm của contract
    setError(undefined); // Xóa lỗi cũ
    setHash(undefined); // Xóa mã giao dịch cũ
    setSigning(true); // Bắt đầu chờ ký
    try { // Thử gửi
      const txHash = await writeContractAsync({ address: marketAddress, abi: marketAbi, functionName, args, value }); // Ví hiện hộp thoại ký
      setHash(txHash); // Lưu mã để theo dõi xác nhận
    } catch (e) { // Bị từ chối hoặc lỗi
      setError(friendlyError(e)); // Đổi thành câu dễ hiểu
    } finally { // Dù thành công hay lỗi
      setSigning(false); // Hết chờ ký
    }
  }

  let status = "idle"; // Trạng thái mặc định
  if (signing) status = "signing"; // Đang chờ ký
  else if (error || receipt.isError) status = "failed"; // Thất bại
  else if (receipt.isSuccess) status = "success"; // Thành công
  else if (hash) status = "confirming"; // Đã ký, đang chờ xác nhận

  const failMessage = error || (receipt.isError ? friendlyError(receipt.error) : undefined); // Câu lỗi để hiện
  return { send, status, hash, failMessage }; // Trả về cho component
}
