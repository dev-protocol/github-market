import {expect, use} from "chai";
import {Contract, ethers} from "ethers";
import {deployContract, MockProvider, solidity} from "ethereum-waffle";
import * as GitHubMarket from "../build/GitHubMarket.json";
import * as MockMarket from "../build/MockMarket.json";
import * as MockMetrics from "../build/MockMetrics.json";

use(solidity);

describe("GitHubMarket", () => {
  const [
    wallet,
    property1,
    property2,
    khaos,
    operator,
  ] = new MockProvider().getWallets();
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

  describe("schema", () => {
    it("Returns this market's schema.", async () => {
      expect(await marketBehavior.schema()).to.equal(
        '["GitHub Repository (e.g, your/awesome-repos)", "Khaos Public Signature"]'
      );
    });
  });
  describe("addPublicSignaturee", () => {
    describe("success", () => {
      it("You can register a public key.", async () => {
        await marketBehavior.setOperator(operator.address);
        await marketBehavior.addPublicSignaturee("dummy-public-key1");
        const marketBehaviorOperator = marketBehavior.connect(operator);
        await marketBehaviorOperator.addPublicSignaturee("dummy-public-key2");
        expect(true).to.be.equal(true);
      });
    });
    describe("fail", () => {
      it("If you are not configured as an operator, you cannot register a public key.", async () => {
        const marketBehaviorOperator = marketBehavior.connect(operator);
        await expect(
          marketBehaviorOperator.addPublicSignaturee("dummy-public-key")
        ).to.be.revertedWith("Invalid sender");
      });
    });
  });
  describe("pause,unpause", () => {
    describe("success", () => {
      it("Non-authentication-related functions can be executed in the pause state.", async () => {
        await marketBehavior.pause();
        await marketBehavior.setPriorApprovedMode(false);
        await marketBehavior.addPublicSignaturee("dummy-sig");
        await marketBehavior.setOperator(operator.address);
        await marketBehavior.setKhaos(khaos.address);
        await marketBehavior.setAssociatedMarket(khaos.address);
        await marketBehavior.schema();
        await marketBehavior.migrate(
          "user/repo",
          market.address,
          property1.address
        );
        await marketBehavior.getId(metrics.address);
        await marketBehavior.getMetrics("user/repo");
        await marketBehavior.done();
      });
      it("When the pause is released, the authentication function can be executed", async () => {
        await marketBehavior.pause();
        await marketBehavior.unpause();
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
      it("Non-authentication-related functions will continue to execute after pause is released", async () => {
        await marketBehavior.pause();
        await marketBehavior.unpause();
        await marketBehavior.setPriorApprovedMode(false);
        await marketBehavior.addPublicSignaturee("dummy-sig");
        await marketBehavior.setOperator(operator.address);
        await marketBehavior.setKhaos(khaos.address);
        await marketBehavior.setAssociatedMarket(khaos.address);
        await marketBehavior.schema();
        await marketBehavior.migrate(
          "user/repo",
          market.address,
          property1.address
        );
        await marketBehavior.getId(metrics.address);
        await marketBehavior.getMetrics("user/repo");
        await marketBehavior.done();
      });
    });
    describe("fail", () => {
      it("Can't pause during pause.", async () => {
        await marketBehavior.pause();
        await expect(marketBehavior.pause()).to.be.revertedWith(
          "Pausable: paused"
        );
      });
      it("Authentication is not possible during pause.", async () => {
        await marketBehavior.pause();
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
            wallet.address
          )
        ).to.be.revertedWith("Pausable: paused");
      });
      it("The callback function cannot be executed during pause.", async () => {
        await marketBehavior.pause();
        await expect(
          marketBehavior.khaosCallback("user/repository", 0, "success")
        ).to.be.revertedWith("Pausable: paused");
      });
      it("You can't unpause when you're not on pause.", async () => {
        await expect(marketBehavior.unpause()).to.be.revertedWith(
          "Pausable: not paused"
        );
      });
      it("Can't unpause while unpausing", async () => {
        await marketBehavior.pause();
        await marketBehavior.unpause();
        await expect(marketBehavior.unpause()).to.be.revertedWith(
          "Pausable: not paused"
        );
      });
      it("Only the deployer can pause.", async () => {
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await expect(marketBehaviorKhaos.pause()).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
      it("Only the deployer can unpause.", async () => {
        await marketBehavior.pause();
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await expect(marketBehaviorKhaos.unpause()).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
    });
  });
  describe("setOperator", () => {
    describe("fail", () => {
      it("If anyone other than the owner runs it, it causes an error.", async () => {
        const marketBehaviorOperator = marketBehavior.connect(operator);
        await expect(
          marketBehaviorOperator.setOperator(operator.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });
  describe("setKhaos", () => {
    describe("fail", () => {
      it("If anyone other than the owner runs it, it causes an error.", async () => {
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await expect(
          marketBehaviorKhaos.setKhaos(khaos.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
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
              wallet.address
            )
          )
            .to.emit(marketBehavior, "Query")
            .withArgs("user/repository", "dummy-signature", wallet.address);
        });
        it("You can also authenticate with a public key set by the operator.", async () => {
          await marketBehavior.setPriorApprovedMode(true);
          await marketBehavior.setAssociatedMarket(wallet.address);
          await marketBehavior.setOperator(operator.address);
          const marketBehaviorOperator = marketBehavior.connect(operator);
          await marketBehaviorOperator.addPublicSignaturee(
            "dummy-signature-second",
            {
              gasLimit: 1000000,
            }
          );
          await expect(
            marketBehavior.authenticate(
              property1.address,
              "user/repository",
              "dummy-signature-second",
              "",
              "",
              "",
              market.address,
              wallet.address
            )
          )
            .to.emit(marketBehavior, "Query")
            .withArgs(
              "user/repository",
              "dummy-signature-second",
              wallet.address
            );
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
              wallet.address
            )
          )
            .to.emit(marketBehavior, "Query")
            .withArgs("user/repository", "dummy-signature", wallet.address);
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
