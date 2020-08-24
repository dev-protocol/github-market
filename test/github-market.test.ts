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
  });

  before(async () => {
    market = await deployContract(wallet, MockMarket);
    metrics = await deployContract(wallet, MockMetrics);
    await market.setLatestMetrics(metrics.address);
  });

  describe("done", () => {
    it("Executing the done function, changes the migratable status.", async () => {
      expect(await marketBehavior.migratable()).to.equal(true);
      await marketBehavior.done();
      expect(await marketBehavior.migratable()).to.equal(false);
    });
  });
  describe("migrate", () => {
    describe("success", () => {
      it("The migrated data will be registered.", async () => {
        await expect(
          marketBehavior.migrate(
            "user/repository",
            market.address,
            property1.address
          )
        )
          .to.emit(marketBehavior, "Registered")
          .withArgs(metrics.address, "user/repository");
        expect(await marketBehavior.getId(metrics.address)).to.equal(
          "user/repository"
        );
        expect(await marketBehavior.getMetrics("user/repository")).to.equal(
          metrics.address
        );
      });
    });
    describe("fail", () => {
      it("If you run the done function, you won't be able to migrate.", async () => {
        await marketBehavior.migrate(
          "user/repository",
          market.address,
          property1.address
        );
        await marketBehavior.done();
        await expect(
          marketBehavior.migrate(
            "user/repository2",
            market.address,
            property2.address
          )
        ).to.be.revertedWith("now is not migratable");
      });
    });
  });

  describe("authenticate", () => {
    describe("success", () => {
      describe("prior approved mode", () => {
        it("Query event data is created.", async () => {
          await marketBehavior.setPriorApprovedMode(true);
          await marketBehavior.setAssociatedMarket(wallet.address);
          await marketBehavior.addPublicSignaturee("dummy-signature");
          await expect(
            marketBehavior.authenticate(
              property1.address,
              "user/repository",
              "dummy-signature",
              "",
              "",
              "",
              market.address,
              ethers.constants.AddressZero
            )
          )
            .to.emit(marketBehavior, "Query")
            .withArgs("user/repository", "dummy-signature");
        });
      });
      describe("not prior approved mode", () => {
        it("Query event data is created.", async () => {
          await marketBehavior.setPriorApprovedMode(false);
          await marketBehavior.setAssociatedMarket(wallet.address);
          await expect(
            marketBehavior.authenticate(
              property1.address,
              "user/repository",
              "dummy-signature",
              "",
              "",
              "",
              market.address,
              ethers.constants.AddressZero
            )
          )
            .to.emit(marketBehavior, "Query")
            .withArgs("user/repository", "dummy-signature");
        });
      });
    });
    describe("fail", () => {
      it("Not prior approved when in prior approval mode.", async () => {
        await marketBehavior.setPriorApprovedMode(true);
        await marketBehavior.setAssociatedMarket(wallet.address);
        await expect(
          marketBehavior.authenticate(
            property1.address,
            "user/repository",
            "dummy-signature",
            "",
            "",
            "",
            market.address,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("it has not been approved");
      });
      it("Sender is not Associated-Market.", async () => {
        await marketBehavior.setPriorApprovedMode(true);
        await marketBehavior.setAssociatedMarket(khaos.address);
        await expect(
          marketBehavior.authenticate(
            property1.address,
            "user/repository",
            "dummy-signature",
            "",
            "",
            "",
            market.address,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Invalid sender");
      });
      it("Already approved.", async () => {
        await marketBehavior.setPriorApprovedMode(true);
        await marketBehavior.setAssociatedMarket(wallet.address);
        await marketBehavior.addPublicSignaturee("dummy-signature");
        await marketBehavior.authenticate(
          property1.address,
          "user/repository",
          "dummy-signature",
          "",
          "",
          "",
          market.address,
          ethers.constants.AddressZero
        );
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await marketBehaviorKhaos.khaosCallback(
          "user/repository",
          0,
          "success"
        );
        await expect(
          marketBehavior.authenticate(
            property1.address,
            "user/repository",
            "dummy-signature",
            "",
            "",
            "",
            market.address,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("already authinticated");
      });
    });
  });
  describe("khaosCallback", () => {
    describe("success", () => {
      it("The authentication is completed when the callback function is executed from khaos.", async () => {
        await marketBehavior.setPriorApprovedMode(true);
        await marketBehavior.setAssociatedMarket(wallet.address);
        await marketBehavior.addPublicSignaturee("dummy-signature");
        await marketBehavior.authenticate(
          property1.address,
          "user/repository",
          "dummy-signature",
          "",
          "",
          "",
          market.address,
          ethers.constants.AddressZero
        );
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await expect(
          marketBehaviorKhaos.khaosCallback("user/repository", 0, "success")
        )
          .to.emit(marketBehavior, "Authenticated")
          .withArgs("user/repository", 0, "success");
        expect(await marketBehavior.getId(metrics.address)).to.equal(
          "user/repository"
        );
        expect(await marketBehavior.getMetrics("user/repository")).to.equal(
          metrics.address
        );
      });
    });
    describe("fail", () => {
      it("If you don't set the khaos address, you'll get an error", async () => {
        await expect(
          marketBehavior.khaosCallback("user/repository", 0, "success")
        ).to.be.revertedWith("illegal access");
      });
      it("If the authentication is not in progress, an error occurs.", async () => {
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await expect(
          marketBehaviorKhaos.khaosCallback("user/repository", 0, "success")
        ).to.be.revertedWith("not while pending");
      });
      it("An error occurs during authentication.", async () => {
        await marketBehavior.setPriorApprovedMode(true);
        await marketBehavior.setAssociatedMarket(wallet.address);
        await marketBehavior.addPublicSignaturee("dummy-signature");
        await marketBehavior.authenticate(
          property1.address,
          "user/repository",
          "dummy-signature",
          "",
          "",
          "",
          market.address,
          ethers.constants.AddressZero
        );
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await expect(
          marketBehaviorKhaos.khaosCallback(
            "user/repository",
            1,
            "test error messaage"
          )
        ).to.be.revertedWith("test error messaage");
      });
    });
  });
});
