const { expect } = require("chai"); // Thư viện kiểm tra kết quả (so sánh, báo lỗi)
const { ethers } = require("hardhat"); // Công cụ ethers do Hardhat cung cấp
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers"); // loadFixture: dựng lại trạng thái sạch cho từng test; time: tua thời gian mạng ảo

const E = ethers.parseEther; // Viết tắt: đổi "1" thành 1 đơn vị tiền (nhân 10^18)
const WINDOW = 3600; // Cửa sổ phán quyết khi test: 1 giờ
const BETTING_TIME = 1000; // Thời gian cược khi test: 1000 giây
const YES = true; // Đặt tên cho dễ đọc: phe Yes
const NO = false; // Đặt tên cho dễ đọc: phe No

async function deployFixture() { // Dựng môi trường test: deploy contract và tạo 1 thị trường
  const [creator, alice, bob, carol, dave] = await ethers.getSigners(); // Lấy 5 ví giả: creator tạo thị trường, 4 người còn lại cược hoặc cọc
  const market = await (await ethers.getContractFactory("PredictionMarket")).deploy(WINDOW); // Deploy contract với cửa sổ 1 giờ
  const bettingEndsAt = (await time.latest()) + BETTING_TIME; // Hạn cược là 1000 giây nữa
  await market.connect(creator).createMarket("Will it rain tomorrow?", bettingEndsAt, 2); // Tạo thị trường số 0
  return { market, bettingEndsAt, creator, alice, bob, carol, dave }; // Trả về mọi thứ test cần
}

async function endBetting(bettingEndsAt) { // Hàm phụ: tua tới lúc hết hạn cược
  await time.increaseTo(bettingEndsAt); // Tua thời gian mạng ảo
}

async function endWindow() { // Hàm phụ: tua qua hết cửa sổ phán quyết (gọi sau khi đã có cọc đầu tiên)
  await time.increase(WINDOW); // Tua thêm 1 giờ
}

describe("PredictionMarket", function () { // Nhóm test của PredictionMarket
  describe("createMarket", function () { // Nhóm test tạo thị trường
    it("stores the question and creator", async function () { // Lưu đúng câu hỏi và người tạo
      const { market, creator, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      const m = await market.markets(0); // Đọc thị trường số 0
      expect(m.question).to.equal("Will it rain tomorrow?"); // Câu hỏi đúng
      expect(m.creator).to.equal(creator.address); // Người tạo đúng
      expect(m.bettingEndsAt).to.equal(bettingEndsAt); // Hạn cược đúng
    });

    it("stores the category chosen by the creator", async function () { // Danh mục được lưu đúng
      const { market, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      expect((await market.markets(0)).category).to.equal(2); // Thị trường số 0 tạo với danh mục 2 (Crypto)
      await market.createMarket("Will Team A win the final?", bettingEndsAt, 1); // Tạo thị trường danh mục 1 (Esports)
      expect((await market.markets(1)).category).to.equal(1); // Danh mục 1 được lưu
    });

    it("rejects an empty question", async function () { // Câu hỏi trống phải bị từ chối
      const { market, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await expect(market.createMarket("", bettingEndsAt, 0)).to.be.revertedWithCustomError(market, "QuestionEmpty"); // Phải revert
    });

    it("rejects a betting end in the past", async function () { // Hạn cược trong quá khứ phải bị từ chối
      const { market } = await loadFixture(deployFixture); // Dựng môi trường
      await expect(market.createMarket("Old?", (await time.latest()) - 1, 0)).to.be.revertedWithCustomError(market, "BetEndInPast"); // Phải revert
    });

    it("has no admin or creator-only function", async function () { // Chứng minh không có hàm đặc quyền
      const { market } = await loadFixture(deployFixture); // Dựng môi trường
      const writeFunctions = market.interface.fragments // Lấy danh sách mọi hàm của contract
        .filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure") // Giữ lại hàm có ghi dữ liệu
        .map((f) => f.name); // Chỉ lấy tên
      expect(writeFunctions.sort()).to.deep.equal(["bet", "claim", "createMarket", "finalize", "postBond"]); // Chỉ 5 hàm ghi, không hàm admin
    });
  });

  describe("bet", function () { // Nhóm test cược
    it("adds to the pools and the user position", async function () { // Cộng đúng vào quỹ và phần của người cược
      const { market, alice } = await loadFixture(deployFixture); // Dựng môi trường
      await market.connect(alice).bet(0, YES, { value: E("1") }); // Alice cược Yes 1
      await market.connect(alice).bet(0, NO, { value: E("2") }); // Alice cược No 2
      const m = await market.markets(0); // Đọc thị trường
      expect(m.poolYes).to.equal(E("1")); // Quỹ Yes đúng
      expect(m.poolNo).to.equal(E("2")); // Quỹ No đúng
      const p = await market.positions(0, alice.address); // Đọc phần của Alice
      expect(p.betYes).to.equal(E("1")); // Phần Yes đúng
      expect(p.betNo).to.equal(E("2")); // Phần No đúng
    });

    it("rejects zero value", async function () { // Không gửi tiền phải bị từ chối
      const { market, alice } = await loadFixture(deployFixture); // Dựng môi trường
      await expect(market.connect(alice).bet(0, YES)).to.be.revertedWithCustomError(market, "ZeroValue"); // Phải revert
    });

    it("rejects bets after the deadline", async function () { // Hết hạn cược thì không cược nữa
      const { market, alice, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await expect(market.connect(alice).bet(0, YES, { value: E("1") })).to.be.revertedWithCustomError(market, "BettingClosed"); // Phải revert
    });

    it("rejects an unknown market", async function () { // Id không tồn tại phải bị từ chối
      const { market, alice } = await loadFixture(deployFixture); // Dựng môi trường
      await expect(market.connect(alice).bet(5, YES, { value: E("1") })).to.be.revertedWithCustomError(market, "UnknownMarket"); // Phải revert
    });
  });

  describe("postBond", function () { // Nhóm test đặt cọc
    it("rejects a bond while betting is still open", async function () { // Chưa hết hạn cược thì chưa được cọc
      const { market, carol } = await loadFixture(deployFixture); // Dựng môi trường
      await expect(market.connect(carol).postBond(0, YES, { value: E("1") })).to.be.revertedWithCustomError(market, "BettingStillOpen"); // Phải revert
    });

    it("opens the window on the first bond", async function () { // Cọc đầu tiên mở cửa sổ phán quyết
      const { market, carol, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      expect((await market.markets(0)).windowEnd).to.equal(0); // Trước cọc đầu tiên chưa có hạn chốt
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Carol cọc Yes
      const bondTime = await time.latest(); // Thời điểm giao dịch cọc
      expect((await market.markets(0)).windowEnd).to.equal(bondTime + WINDOW); // Hạn chốt là 1 giờ sau cọc đầu tiên
    });

    it("rejects a bond after the window is over", async function () { // Hết cửa sổ thì không cọc thêm
      const { market, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Cọc đầu tiên
      await endWindow(); // Tua qua hết cửa sổ
      await expect(market.connect(dave).postBond(0, NO, { value: E("5") })).to.be.revertedWithCustomError(market, "WindowOver"); // Phải revert
    });
  });

  describe("finalize", function () { // Nhóm test chốt kết quả
    it("reverts when no bond was posted", async function () { // Chưa ai cọc thì chưa chốt được
      const { market, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await expect(market.finalize(0)).to.be.revertedWithCustomError(market, "NoBondYet"); // Phải revert
    });

    it("reverts before the window is over", async function () { // Cửa sổ chưa hết thì chưa chốt được
      const { market, carol, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Cọc đầu tiên
      await expect(market.finalize(0)).to.be.revertedWithCustomError(market, "WindowNotOver"); // Phải revert
    });

    it("refunds all bets when nobody posts a bond for 7 days", async function () { // Không ai cọc trong 7 ngày thì hoàn tiền cược
      const { market, alice, bob, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await market.connect(alice).bet(0, YES, { value: E("1") }); // Alice cược Yes 1
      await market.connect(bob).bet(0, NO, { value: E("3") }); // Bob cược No 3
      await time.increaseTo(bettingEndsAt + 7 * 24 * 3600 - 5); // Tua tới ngay trước mốc 7 ngày
      await expect(market.finalize(0)).to.be.revertedWithCustomError(market, "NoBondYet"); // Chưa đủ 7 ngày thì chưa hoàn
      await time.increaseTo(bettingEndsAt + 7 * 24 * 3600); // Tua tới đúng mốc 7 ngày
      await expect(market.connect(alice).claim(0)).to.changeEtherBalance(alice, E("1")); // Alice lấy lại 1
      await expect(market.connect(bob).claim(0)).to.changeEtherBalance(bob, E("3")); // Bob lấy lại 3
      expect((await market.markets(0)).result).to.equal(3); // 3 nghĩa là Result.Invalid
    });

    it("rejects a bond after the no-bond refund happened", async function () { // Đã hoàn tiền thì không cọc nữa
      const { market, alice, carol, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await market.connect(alice).bet(0, YES, { value: E("1") }); // Alice cược
      await time.increaseTo(bettingEndsAt + 7 * 24 * 3600); // Tua tới mốc 7 ngày
      await market.finalize(0); // Ai đó chốt hoàn tiền
      await expect(market.connect(carol).postBond(0, YES, { value: E("1") })).to.be.revertedWithCustomError(market, "AlreadyFinalized"); // Cọc muộn phải revert
    });

    it("picks the side with the larger bond", async function () { // Phe cọc lớn hơn thắng
      const { market, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Carol cọc Yes 1
      await market.connect(dave).postBond(0, NO, { value: E("2") }); // Dave phản đối bằng cọc No 2
      await endWindow(); // Tua qua hết cửa sổ
      await market.finalize(0); // Chốt
      expect((await market.markets(0)).result).to.equal(2); // 2 nghĩa là Result.No
    });

    it("lets a later, larger bond overturn the first proposal", async function () { // Cuộc đấu cọc: ai cọc nhiều hơn sẽ lật được
      const { market, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("5") }); // Carol cọc Yes 5
      await market.connect(dave).postBond(0, NO, { value: E("2") }); // Dave cọc No 2, chưa đủ
      await market.connect(dave).postBond(0, NO, { value: E("4") }); // Dave tăng cọc No lên 6, vượt 5
      await endWindow(); // Tua qua hết cửa sổ
      await market.finalize(0); // Chốt
      expect((await market.markets(0)).result).to.equal(2); // No thắng
    });
  });

  describe("claim", function () { // Nhóm test nhận tiền
    async function yesWinsFixture() { // Dựng tình huống Yes thắng
      const base = await deployFixture(); // Môi trường cơ bản
      const { market, alice, bob, carol, dave, bettingEndsAt } = base; // Lấy các thứ cần
      await market.connect(alice).bet(0, YES, { value: E("1") }); // Alice cược Yes 1
      await market.connect(bob).bet(0, NO, { value: E("3") }); // Bob cược No 3
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("5") }); // Carol cọc Yes 5
      await market.connect(dave).postBond(0, NO, { value: E("2") }); // Dave cọc No 2
      await endWindow(); // Tua qua hết cửa sổ
      return base; // Trả về môi trường
    }

    it("pays the winning bettor the whole bet pool", async function () { // Người cược thắng nhận cả quỹ cược
      const { market, alice } = await loadFixture(yesWinsFixture); // Dựng tình huống
      await expect(market.connect(alice).claim(0)).to.changeEtherBalances([alice, market], [E("4"), -E("4")]); // Quỹ cược 1 + 3 = 4, Alice là người Yes duy nhất nên nhận hết
    });

    it("pays the winning bonder the whole bond pool", async function () { // Người cọc thắng nhận cả quỹ cọc
      const { market, carol } = await loadFixture(yesWinsFixture); // Dựng tình huống
      await expect(market.connect(carol).claim(0)).to.changeEtherBalances([carol, market], [E("7"), -E("7")]); // Quỹ cọc 5 + 2 = 7, Carol là người cọc Yes duy nhất nên nhận hết
    });

    it("gives the losing side nothing", async function () { // Phe thua không nhận được gì
      const { market, bob, dave } = await loadFixture(yesWinsFixture); // Dựng tình huống
      await expect(market.connect(bob).claim(0)).to.be.revertedWithCustomError(market, "NothingToClaim"); // Bob cược No nên mất
      await expect(market.connect(dave).claim(0)).to.be.revertedWithCustomError(market, "NothingToClaim"); // Dave cọc No nên mất
    });

    it("empties the contract once every winner claimed", async function () { // Không còn tiền kẹt trong contract
      const { market, alice, carol } = await loadFixture(yesWinsFixture); // Dựng tình huống
      await market.connect(alice).claim(0); // Alice nhận
      await market.connect(carol).claim(0); // Carol nhận
      expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(0); // Contract hết sạch tiền
    });

    it("splits a pool in proportion between two winners", async function () { // Hai người thắng chia quỹ theo tỉ lệ
      const { market, alice, bob, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await market.connect(alice).bet(0, YES, { value: E("1") }); // Alice cược Yes 1
      await market.connect(bob).bet(0, YES, { value: E("3") }); // Bob cược Yes 3
      await market.connect(dave).bet(0, NO, { value: E("4") }); // Dave cược No 4
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Cọc Yes
      await endWindow(); // Tua qua hết cửa sổ
      await expect(market.connect(alice).claim(0)).to.changeEtherBalance(alice, E("2")); // Alice có 1/4 phe Yes nên nhận 1/4 của 8 = 2
      await expect(market.connect(bob).claim(0)).to.changeEtherBalance(bob, E("6")); // Bob có 3/4 phe Yes nên nhận 3/4 của 8 = 6
    });

    it("blocks a second claim", async function () { // Không nhận được hai lần
      const { market, alice } = await loadFixture(yesWinsFixture); // Dựng tình huống
      await market.connect(alice).claim(0); // Nhận lần 1
      await expect(market.connect(alice).claim(0)).to.be.revertedWithCustomError(market, "AlreadyClaimed"); // Lần 2 phải revert
    });

    it("reverts before the window is over", async function () { // Chưa hết cửa sổ thì chưa nhận được
      const { market, alice, carol, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await market.connect(alice).bet(0, YES, { value: E("1") }); // Alice cược
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Cọc đầu tiên
      await expect(market.connect(alice).claim(0)).to.be.revertedWithCustomError(market, "WindowNotOver"); // Phải revert
    });

    it("refunds everyone when the bonds tie", async function () { // Hòa cọc thì hoàn tiền hết
      const { market, alice, bob, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await market.connect(alice).bet(0, YES, { value: E("1") }); // Alice cược Yes 1
      await market.connect(bob).bet(0, NO, { value: E("3") }); // Bob cược No 3
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("2") }); // Carol cọc Yes 2
      await market.connect(dave).postBond(0, NO, { value: E("2") }); // Dave cọc No 2, hòa
      await endWindow(); // Tua qua hết cửa sổ
      await expect(market.connect(alice).claim(0)).to.changeEtherBalance(alice, E("1")); // Alice lấy lại 1
      await expect(market.connect(bob).claim(0)).to.changeEtherBalance(bob, E("3")); // Bob lấy lại 3
      await expect(market.connect(carol).claim(0)).to.changeEtherBalance(carol, E("2")); // Carol lấy lại cọc 2
      await expect(market.connect(dave).claim(0)).to.changeEtherBalance(dave, E("2")); // Dave lấy lại cọc 2
    });

    it("refunds bets when nobody bet on the winning side", async function () { // Không ai cược phe thắng thì hoàn tiền cược
      const { market, bob, carol, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await market.connect(bob).bet(0, NO, { value: E("3") }); // Chỉ có Bob cược No 3
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Yes thắng nhưng không ai cược Yes
      await endWindow(); // Tua qua hết cửa sổ
      await expect(market.connect(bob).claim(0)).to.changeEtherBalance(bob, E("3")); // Bob lấy lại tiền cược
    });
  });

  describe("late bond protection", function () { // Nhóm test chống cọc phút chót
    it("extends the window when a bond arrives in the last quarter", async function () { // Cọc ở phần tư cuối thì kéo dài cửa sổ
      const { market, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Cọc đầu tiên mở cửa sổ 3600 giây
      const first = Number((await market.markets(0)).windowEnd); // Hạn chốt ban đầu
      await time.setNextBlockTimestamp(first - 600); // Còn 600 giây, ít hơn một phần tư (900)
      await market.connect(dave).postBond(0, NO, { value: E("2") }); // Cọc phút chót
      expect((await market.markets(0)).windowEnd).to.equal(first - 600 + 900); // Hạn chốt mới = lúc cọc + 900
    });

    it("does not extend the window for an early bond", async function () { // Cọc sớm thì không đổi hạn chốt
      const { market, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("1") }); // Cọc đầu tiên
      const first = Number((await market.markets(0)).windowEnd); // Hạn chốt ban đầu
      await time.setNextBlockTimestamp(first - 3000); // Còn 3000 giây, nhiều hơn một phần tư
      await market.connect(dave).postBond(0, NO, { value: E("2") }); // Cọc sớm
      expect((await market.markets(0)).windowEnd).to.equal(first); // Hạn chốt không đổi
    });

    it("gives the other side time to answer a last-second bond", async function () { // Phe kia kịp đáp trả cọc giây cuối
      const { market, carol, dave, bettingEndsAt } = await loadFixture(deployFixture); // Dựng môi trường
      await endBetting(bettingEndsAt); // Tua tới hết hạn cược
      await market.connect(carol).postBond(0, YES, { value: E("5") }); // Carol cọc Yes 5
      const first = Number((await market.markets(0)).windowEnd); // Hạn chốt ban đầu
      await time.setNextBlockTimestamp(first - 1); // Một giây trước hạn chốt
      await market.connect(dave).postBond(0, NO, { value: E("6") }); // Dave cọc No 6, đang dẫn
      await time.setNextBlockTimestamp(first + 100); // Đã qua hạn chốt ban đầu nhưng cửa sổ đã được kéo dài
      await market.connect(carol).postBond(0, YES, { value: E("3") }); // Carol đáp trả, giờ Yes dẫn 8 so với 6
      await endWindow(); // Tua qua hết cửa sổ đã kéo dài
      await market.finalize(0); // Chốt
      expect((await market.markets(0)).result).to.equal(1); // 1 nghĩa là Result.Yes
    });

    it("rejects a window shorter than 4 seconds", async function () { // Cửa sổ quá ngắn bị từ chối khi deploy
      const factory = await ethers.getContractFactory("PredictionMarket"); // Bản thiết kế contract
      await expect(factory.deploy(3)).to.be.revertedWithCustomError(factory, "WindowTooShort"); // Phải revert
    });
  });
});
