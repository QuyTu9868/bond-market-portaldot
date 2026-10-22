// SPDX-License-Identifier: MIT
// Giấy phép mã nguồn mở MIT
pragma solidity ^0.8.24; // Phiên bản trình biên dịch

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol"; // Thư viện ERC20 chuẩn của OpenZeppelin (đã được kiểm toán nhiều lần)

/// @title LaunchToken
/// @notice Token meme do Launchpad tạo ra. Toàn bộ nguồn cung được tạo 1 lần lúc khởi tạo, không ai in thêm được.
contract LaunchToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1 tỷ token (chữ ether ở đây chỉ là 18 số 0, không liên quan tiền ETH)

    constructor(string memory name_, string memory symbol_, address launchpad_) ERC20(name_, symbol_) { // Chạy đúng 1 lần lúc token được tạo
        _mint(launchpad_, TOTAL_SUPPLY); // In hết nguồn cung và gửi cho Launchpad giữ. Không có hàm mint nào khác nên không in thêm được
    }
}
