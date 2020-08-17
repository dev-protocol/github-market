import {expect, use} from "chai";
import {Contract, ethers} from "ethers";
import {deployContract, MockProvider, solidity} from "ethereum-waffle";
import * as GitHubMarket from "../build/GitHubMarket.json";
import * as MockMarket from "../build/MockMarket.json";
import * as MockMetrics from "../build/MockMetrics.json";

use(solidity);

describe("GitHubMarket", () => {
  const [wallet, property1, property2, khaos] = new MockProvider().getWallets();
  let marketBehavior: Contract;
  let market: Contract;
  let metrics: Contract;

  beforeEach(async () => {
    marketBehavior = await deployContract(wallet, GitHubMarket);
    market = await deployContract(wallet, MockMarket);
  });

  before(async () => {
    market = await deployContract(wallet, MockMarket);
    metrics = await deployContract(wallet, MockMetrics);
  });

  describe("done", () => {
    it("migratableが変わる", async () => {
      expect(await marketBehavior.migratable()).to.equal(true);
      await marketBehavior.done();
      expect(await marketBehavior.migratable()).to.equal(false);
    });
  });
  describe("migrate", () => {
    describe("success", () => {
      it("migrateしたデータが登録される", async () => {
        await market.setLatestMetrics(metrics.address);
        await expect(
          marketBehavior.migrate(
            property1.address,
            "test-package1",
            market.address
          )
        )
          .to.emit(marketBehavior, "Registered")
          .withArgs(metrics.address, "test-package1");
        expect(await marketBehavior.getId(metrics.address)).to.equal(
          "test-package1"
        );
        expect(await marketBehavior.getMetrics("test-package1")).to.equal(
          metrics.address
        );
      });
    });
    describe("fail", () => {
      it("doneするとmigrateができなくなる", async () => {
        await marketBehavior.migrate(
          property1.address,
          "test-package1",
          market.address
        );
        await marketBehavior.done();
        await expect(
          marketBehavior.migrate(
            property2.address,
            "test-package2",
            market.address
          )
        ).to.be.reverted;
      });
    });
  });

  describe("authenticate", () => {
    it("連携データが作成される", async () => {
      const hash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("test-package1")
      );
      await expect(
        marketBehavior.authenticate(
          property1.address,
          "test-package1",
          "dummy-signature",
          "",
          "",
          "",
          market.address
        )
      )
        .to.emit(marketBehavior, "Query")
        .withArgs([
          hash,
          "test-package1",
          "dummy-signature",
          market.address,
          property1.address,
        ]);
    });
  });
  describe("khaosCallback", () => {
    //describe("success", () => {});
    describe("fail", () => {
      it("khaosのアドレスをセットしていないとエラー", async () => {
        await expect(marketBehavior.khaosCallback("0x01")).to.be.reverted;
      });
      it("khaosのアドレスをセットしていてもkhaosが実行者じゃなければエラー", async () => {
        //const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await expect(marketBehavior.khaosCallback("0x01")).to.be.reverted;
      });
    });
  });
  //   it('Assigns initial balance', async () => {
  //     expect(await token.balanceOf(wallet.address)).to.equal(1000);
  //   });

  //   it('Transfer adds amount to destination account', async () => {
  //     await token.transfer(walletTo.address, 7);
  //     expect(await token.balanceOf(walletTo.address)).to.equal(7);
  //   });

  //   it('Transfer emits event', async () => {
  //     await expect(token.transfer(walletTo.address, 7))
  //       .to.emit(token, 'Transfer')
  //       .withArgs(wallet.address, walletTo.address, 7);
  //   });

  //   it('Can not transfer above the amount', async () => {
  //     await expect(token.transfer(walletTo.address, 1007)).to.be.reverted;
  //   });

  //   it('Can not transfer from empty account', async () => {
  //     const tokenFromOtherWallet = token.connect(walletTo);
  //     await expect(tokenFromOtherWallet.transfer(wallet.address, 1))
  //       .to.be.reverted;
  //   });

  //   it('Calls totalSupply on BasicToken contract', async () => {
  //     await token.totalSupply();
  //     expect('totalSupply').to.be.calledOnContract(token);
  //   });

  //   it('Calls balanceOf with sender address on BasicToken contract', async () => {
  //     await token.balanceOf(wallet.address);
  //     expect('balanceOf').to.be.calledOnContractWith(token, [wallet.address]);
  //   });
});
