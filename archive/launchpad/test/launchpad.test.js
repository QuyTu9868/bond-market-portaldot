const { expect } = require("chai"); // Thư viện kiểm tra kết quả (so sánh, báo lỗi)
const { ethers } = require("hardhat"); // Công cụ ethers do Hardhat cung cấp
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers"); // loadFixture: dựng lại trạng thái sạch cho từng test; time: tua thời gian mạng ảo

const E = ethers.parseEther; // Viết tắt: đổi "1" thành 1 đơn vị tiền (nhân 10^18)
const INITIAL_VIRTUAL = E("3"); // Tiền ảo ban đầu dùng khi test
const GRADUATION = E("8.5"); // Mục tiêu tốt nghiệp dùng khi test

async function deployFixture() { // Dựng môi trường test: deploy Launchpad và tạo 1 token
  const [deployer, creator, buyer, bot] = await ethers.getSigners(); // Lấy 4 ví giả: deployer là treasury, creator tạo token, buyer là người mua thật, bot là bot mua đầu
  const launchpad = await (await ethers.getContractFactory("Launchpad")).deploy(INITIAL_VIRTUAL, GRADUATION); // Deploy Launchpad
  await launchpad.connect(creator).createToken("Fair", "FAIR", 100); // Creator tạo token với phí 1% (100 bps)
  const tokenAddress = await launchpad.allTokens(0); // Địa chỉ token vừa tạo
  const token = await ethers.getContractAt("LaunchToken", tokenAddress); // Kết nối tới token
  const createdAt = Number((await launchpad.curves(tokenAddress)).createdAt); // Thời điểm tạo token (giây)
  return { launchpad, token, tokenAddress, createdAt, deployer, creator, buyer, bot }; // Trả về mọi thứ test cần
}

async function buyAt(launchpad, signer, tokenAddress, createdAt, secondsAfterCreate, amount) { // Hàm phụ: mua đúng ở giây thứ N sau khi tạo token
  await time.setNextBlockTimestamp(createdAt + secondsAfterCreate); // Ép block kế tiếp có đúng mốc thời gian này
  return launchpad.connect(signer).buy(tokenAddress, 0, { value: amount }); // Gửi lệnh mua
}

describe("Launchpad", function () { // Nhóm test của Launchpad
  describe("createToken", function () { // Nhóm test tạo token
    it("gives the whole supply to the launchpad", async function () { // Toàn bộ nguồn cung về Launchpad
      const { launchpad, token } = await loadFixture(deployFixture); // Dựng môi trường
      expect(await token.balanceOf(await launchpad.getAddress())).to.equal(await token.TOTAL_SUPPLY()); // Launchpad giữ đủ 1 tỷ token
    });

    it("rejects a creator fee above the max", async function () { // Phí người tạo vượt 2% phải bị từ chối
      const { launchpad, creator } = await loadFixture(deployFixture); // Dựng môi trường
      await expect(launchpad.connect(creator).createToken("Bad", "BAD", 201)).to.be.revertedWith("Creator fee above max"); // 2.01% phải revert
    });

    it("has no function that can change the creator fee later", async function () { // Chứng minh phí người tạo bị khóa cứng
      const { launchpad } = await loadFixture(deployFixture); // Dựng môi trường
      const writeFunctions = launchpad.interface.fragments // Lấy danh sách mọi hàm của contract
        .filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure") // Giữ lại hàm có ghi dữ liệu
        .map((f) => f.name); // Chỉ lấy tên
      expect(writeFunctions.sort()).to.deep.equal(["buy", "claimFees", "createToken", "sell"]); // Chỉ có 4 hàm ghi, không hàm nào sửa phí
    });
  });

  describe("anti-sniper fee", function () { // Nhóm test phí chống bot
    it("starts near 50% and decays linearly to 0 after the window", async function () { // Phí giảm đều
      const { launchpad, tokenAddress, createdAt } = await loadFixture(deployFixture); // Dựng môi trường
      await time.setNextBlockTimestamp(createdAt + 6); // Đặt thời gian là giây thứ 6
      await time.increaseTo(createdAt + 6); // Chuyển mạng ảo đến mốc đó
      expect(await launchpad.currentSnipeFeeBps(tokenAddress)).to.equal(4900); // 5000 nhân 294 chia 300 = 4900
      await time.increaseTo(createdAt + 150); // Tới giữa cửa sổ
      expect(await launchpad.currentSnipeFeeBps(tokenAddress)).to.equal(2500); // Còn một nửa
      await time.increaseTo(createdAt + 300); // Hết cửa sổ
      expect(await launchpad.currentSnipeFeeBps(tokenAddress)).to.equal(0); // Không còn phí chống bot
    });

    it("makes a bot that buys in the first seconds get far fewer tokens than the same buy after the window", async function () { // Bot mua đầu bị thiệt rõ ràng
      const a = await loadFixture(deployFixture); // Thế giới A: trạng thái sạch, bot mua sớm
      await buyAt(a.launchpad, a.bot, a.tokenAddress, a.createdAt, 6, E("1")); // Bot mua 1 đơn vị ở giây thứ 6
      const botTokens = await a.token.balanceOf(a.bot.address); // Số token bot nhận
      const b = await loadFixture(deployFixture); // Thế giới B: quay về trạng thái sạch y hệt để so công bằng
      await buyAt(b.launchpad, b.buyer, b.tokenAddress, b.createdAt, 400, E("1")); // Người mua thật mua cùng số tiền ở giây thứ 400
      const honestTokens = await b.token.balanceOf(b.buyer.address); // Số token người mua thật nhận
      expect(botTokens * 100n).to.be.lt(honestTokens * 60n); // Bot nhận chưa tới 60% so với người mua thật
    });

    it("sends the snipe fee to the treasury ledger", async function () { // Phí chống bot vào sổ treasury
      const { launchpad, tokenAddress, createdAt, deployer, bot } = await loadFixture(deployFixture); // Dựng môi trường
      await buyAt(launchpad, bot, tokenAddress, createdAt, 6, E("1")); // Bot mua 1 đơn vị ở giây thứ 6, phí chống bot 49%
      expect(await launchpad.feesOwed(deployer.address)).to.equal(E("0.49")); // Treasury được ghi 0.49
    });

    it("charges no snipe fee after the window", async function () { // Sau 5 phút không còn phí chống bot
      const { launchpad, tokenAddress, createdAt, deployer, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await buyAt(launchpad, buyer, tokenAddress, createdAt, 301, E("1")); // Mua ở giây thứ 301
      expect(await launchpad.feesOwed(deployer.address)).to.equal(0); // Treasury không nhận gì
    });
  });

  describe("buy", function () { // Nhóm test mua
    it("matches the quote", async function () { // Giá báo trước khớp với thực tế
      const { launchpad, token, tokenAddress, createdAt, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await time.increaseTo(createdAt + 400); // Tua mạng ảo tới sau cửa sổ để phí chống bot bằng 0 (báo giá đọc theo thời gian hiện tại của mạng)
      const [expected] = await launchpad.quoteBuy(tokenAddress, E("1")); // Giá báo trước ở thời điểm này
      await launchpad.connect(buyer).buy(tokenAddress, 0, { value: E("1") }); // Mua thật
      expect(await token.balanceOf(buyer.address)).to.equal(expected); // Số token nhận được bằng số báo trước
    });

    it("reverts when slippage is worse than the minimum", async function () { // Bảo vệ trượt giá
      const { launchpad, tokenAddress, createdAt, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await time.setNextBlockTimestamp(createdAt + 400); // Sau cửa sổ
      await expect(launchpad.connect(buyer).buy(tokenAddress, E("999999999"), { value: E("1") })).to.be.revertedWith("Slippage: got fewer tokens than minimum"); // Đòi quá nhiều token thì revert
    });

    it("reverts for an unknown token", async function () { // Token không tồn tại
      const { launchpad, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await expect(launchpad.connect(buyer).buy(buyer.address, 0, { value: E("1") })).to.be.revertedWith("Unknown token"); // Địa chỉ lạ bị từ chối
    });

    it("reverts when one buy would exceed the curve cap", async function () { // Mua quá lớn trong 1 lần
      const { launchpad, tokenAddress, createdAt, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await time.setNextBlockTimestamp(createdAt + 400); // Sau cửa sổ để dễ tính
      await expect(launchpad.connect(buyer).buy(tokenAddress, 0, { value: E("20") })).to.be.revertedWith("Exceeds curve cap, buy less"); // 20 đơn vị mua vượt 800 triệu token
    });
  });

  describe("creator fee", function () { // Nhóm test phí người tạo
    it("pays 1% of each buy to the creator and lets them claim once", async function () { // Người tạo nhận 1% và rút được
      const { launchpad, tokenAddress, createdAt, creator, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await buyAt(launchpad, buyer, tokenAddress, createdAt, 400, E("1")); // Mua 1 đơn vị sau cửa sổ
      expect(await launchpad.feesOwed(creator.address)).to.equal(E("0.01")); // Người tạo được ghi 1%
      await expect(launchpad.connect(creator).claimFees()).to.changeEtherBalance(creator, E("0.01")); // Rút phí: ví người tạo tăng đúng 0.01 (bộ so sánh mặc định bỏ qua phí gas)
      expect(await launchpad.feesOwed(creator.address)).to.equal(0); // Sổ phí về 0 sau khi rút
      await expect(launchpad.connect(creator).claimFees()).to.be.revertedWith("No fees to claim"); // Rút lần hai thì bị từ chối
    });
  });

  describe("sell", function () { // Nhóm test bán
    it("fails without approval, works after approval", async function () { // Phải approve trước khi bán
      const { launchpad, token, tokenAddress, createdAt, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await buyAt(launchpad, buyer, tokenAddress, createdAt, 400, E("1")); // Mua trước
      const amount = (await token.balanceOf(buyer.address)) / 2n; // Bán một nửa
      await expect(launchpad.connect(buyer).sell(tokenAddress, amount, 0)).to.be.reverted; // Chưa approve nên thất bại
      await token.connect(buyer).approve(await launchpad.getAddress(), amount); // Approve
      await expect(launchpad.connect(buyer).sell(tokenAddress, amount, 0)).to.emit(launchpad, "Sold"); // Bán thành công và có sự kiện Sold
    });

    it("never pays out more than was put in (buy then sell all)", async function () { // Mua rồi bán hết không bao giờ lời từ không khí
      const { launchpad, token, tokenAddress, createdAt, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await buyAt(launchpad, buyer, tokenAddress, createdAt, 400, E("1")); // Mua 1 đơn vị
      const all = await token.balanceOf(buyer.address); // Toàn bộ token đang có
      await token.connect(buyer).approve(await launchpad.getAddress(), all); // Approve hết
      const before = await ethers.provider.getBalance(buyer.address); // Số dư trước khi bán
      const tx = await launchpad.connect(buyer).sell(tokenAddress, all, 0); // Bán hết
      const receipt = await tx.wait(); // Chờ xác nhận
      const after = await ethers.provider.getBalance(buyer.address); // Số dư sau khi bán
      const received = after - before + receipt.gasUsed * receipt.gasPrice; // Tiền thực nhận (cộng lại phí gas đã trả)
      expect(received).to.be.lt(E("1")); // Nhận về ít hơn 1 đơn vị đã bỏ ra (mất phí 2 lần của người tạo)
      expect(received).to.be.gt(E("0.97")); // Nhưng không mất quá nhiều (chỉ khoảng 2% phí)
    });

    it("applies no snipe fee on sells but still charges the creator fee", async function () { // Bán chỉ chịu phí người tạo
      const { launchpad, token, tokenAddress, createdAt, creator, deployer, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await buyAt(launchpad, buyer, tokenAddress, createdAt, 400, E("1")); // Mua sau cửa sổ
      const feesBefore = await launchpad.feesOwed(creator.address); // Phí người tạo trước khi bán
      const amount = await token.balanceOf(buyer.address); // Bán hết
      await token.connect(buyer).approve(await launchpad.getAddress(), amount); // Approve
      await launchpad.connect(buyer).sell(tokenAddress, amount, 0); // Bán
      expect(await launchpad.feesOwed(creator.address)).to.be.gt(feesBefore); // Phí người tạo tăng thêm
      expect(await launchpad.feesOwed(deployer.address)).to.equal(0); // Treasury vẫn bằng 0
    });
  });

  describe("graduation", function () { // Nhóm test tốt nghiệp
    it("stops buys after the target is reached but still lets holders sell", async function () { // Đạt mục tiêu thì ngừng mua, vẫn bán được
      const { launchpad, token, tokenAddress, createdAt, buyer } = await loadFixture(deployFixture); // Dựng môi trường
      await buyAt(launchpad, buyer, tokenAddress, createdAt, 400, E("8.7")); // Mua lớn để vượt mục tiêu 8.5 (sau trừ phí 1% vẫn trên 8.5)
      expect((await launchpad.curves(tokenAddress)).graduated).to.equal(true); // Đã tốt nghiệp
      await expect(launchpad.connect(buyer).buy(tokenAddress, 0, { value: E("0.1") })).to.be.revertedWith("Curve already graduated"); // Không cho mua nữa
      const amount = (await token.balanceOf(buyer.address)) / 2n; // Bán một nửa
      await token.connect(buyer).approve(await launchpad.getAddress(), amount); // Approve
      await expect(launchpad.connect(buyer).sell(tokenAddress, amount, 0)).to.emit(launchpad, "Sold"); // Vẫn bán được, không bị kẹt tiền
    });
  });
});
