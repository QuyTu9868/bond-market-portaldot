// SPDX-License-Identifier: MIT
// Giấy phép mã nguồn mở MIT, file Solidity nên có dòng này
pragma solidity ^0.8.24; // Cho phép trình biên dịch từ bản 0.8.24 trở lên

/// @title Ping
/// @notice Contract nhỏ nhất có thể. Chỉ dùng ở checkpoint 0 để kiểm tra mạng Portaldot chạy được Solidity thật.
contract Ping {
    uint256 public pingCount; // Biến đếm số lần ping, ai cũng đọc được nhờ chữ public

    event Pinged(address indexed sender, uint256 count); // Sự kiện ghi lại mỗi lần ping để dễ tra trên explorer

    function ping() external { // Hàm ai cũng gọi được, tốn phí gas vì ghi dữ liệu lên chain
        pingCount += 1; // Tăng bộ đếm lên 1
        emit Pinged(msg.sender, pingCount); // Phát sự kiện: ai vừa ping và đang ở lần thứ mấy
    }
}
