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
            property1.address,
            "user/repository",
            market.address
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
          property1.address,
          "user/repository",
          market.address
        );
        await marketBehavior.done();
        await expect(
          marketBehavior.migrate(
            property2.address,
            "user/repository2",
            market.address
          )
        ).to.be.revertedWith("now is not migratable");
      });
    });
  });

  describe("authenticate", () => {
    describe("success", () => {
      it("Query event data is created.", async () => {
        const hash = getIdHash("user/repository");
        await expect(
          marketBehavior.authenticate(
            property1.address,
            "user/repository",
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
            "dummy-signature",
            '{"property":"' +
              property1.address.toLowerCase() +
              '", "repository":"user/repository"}',
          ]);
      });
    });
    describe("fail", () => {
      it("An error occurs when you re-authenticate during authentication.", async () => {
        await marketBehavior.authenticate(
          property1.address,
          "user/repository",
          "dummy-signature",
          "",
          "",
          "",
          market.address
        );
        await expect(
          marketBehavior.authenticate(
            property1.address,
            "user/repository",
            "dummy-signature",
            "",
            "",
            "",
            market.address
          )
        ).to.be.revertedWith("while pending");
      });
    });
  });
  describe("khaosCallback", () => {
    describe("success", () => {
      it("The authentication is completed when the callback function is executed from khaos.", async () => {
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await marketBehavior.authenticate(
          property1.address,
          "user/repository",
          "dummy-signature",
          "",
          "",
          "",
          market.address
        );
        const [data, additionalDataString] = getKhaosCallbackData(
          "user/repository",
          property1.address
        );
        const hash = getIdHash("user/repository");
        await expect(marketBehaviorKhaos.khaosCallback(data))
          .to.emit(marketBehavior, "Authenticated")
          .withArgs([hash, additionalDataString]);
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
        await expect(marketBehavior.khaosCallback("0x01")).to.be.revertedWith(
          "illegal access"
        );
      });
      it("If khaos is not the executor, an error will occur.ー", async () => {
        await marketBehavior.setKhaos(khaos.address);
        await expect(marketBehavior.khaosCallback("0x01")).to.be.revertedWith(
          "illegal access"
        );
      });
      it("If the authentication is not in progress, an error occurs.", async () => {
        const [data] = getKhaosCallbackData(
          "user/repository",
          property1.address
        );
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await expect(
          marketBehaviorKhaos.khaosCallback(data)
        ).to.be.revertedWith("not while pending");
      });
      it("An error occurs during authentication.", async () => {
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await marketBehavior.authenticate(
          property1.address,
          "user/repository",
          "dummy-signature",
          "",
          "",
          "",
          market.address
        );
        const [data] = getKhaosCallbackData(
          "user/repository",
          property1.address,
          1,
          "test error messaage"
        );
        await expect(
          marketBehaviorKhaos.khaosCallback(data)
        ).to.be.revertedWith("test error messaage");
      });
    });
  });
});

function getIdHash(_repository: string): string {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(_repository));
  return hash;
}

function getKhaosCallbackData(
  _repository: string,
  _propertyAddress: string,
  _status = 0,
  _errorMessage = ""
): readonly [string, string] {
  const hash = getIdHash(_repository);
  const additionalData = {
    repository: _repository,
    property: _propertyAddress,
    status: _status,
    errorMessage: _errorMessage,
  };
  const abi = new ethers.utils.AbiCoder();
  const data = abi.encode(
    ["tuple(bytes32, string)"],
    [[hash, JSON.stringify(additionalData)]]
  );
  return [data, JSON.stringify(additionalData)];
}
