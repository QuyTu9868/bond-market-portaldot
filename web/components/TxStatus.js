"use client"; // Chạy ở trình duyệt

import { explorerTxUrl } from "../lib/config"; // Tiền tố link xem giao dịch

export default function TxStatus({ tx }) { // Hiện trạng thái của một giao dịch
  if (tx.status === "idle") return null; // Chưa làm gì thì không hiện
  if (tx.status === "signing") return <p className="status">Waiting for your signature in the wallet...</p>; // Chờ ký
  if (tx.status === "confirming") return <p className="status">Confirming on chain...</p>; // Đang xác nhận
  if (tx.status === "failed") return <p className="status error">{tx.failMessage}</p>; // Thất bại kèm lý do
  return ( // Thành công
    <p className="status ok">
      Done.{" "}
      {explorerTxUrl && tx.hash ? <a href={explorerTxUrl + tx.hash} target="_blank" rel="noreferrer">View transaction</a> : <span className="muted">tx {tx.hash?.slice(0, 10)}...</span>}
    </p>
  );
}
