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
    it("migratableが変わる", async () => {
      expect(await marketBehavior.migratable()).to.equal(true);
      await marketBehavior.done();
      expect(await marketBehavior.migratable()).to.equal(false);
    });
  });
  describe("migrate", () => {
    describe("success", () => {
      it("migrateしたデータが登録される", async () => {
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
        ).to.be.revertedWith("now is not migratable");
      });
    });
  });

  describe("authenticate", () => {
    describe("success", () => {
      it("連携データが作成される", async () => {
        const hash = getIdHash("test-package1");
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
    describe("fail", () => {
      it("認証中に忍性", async () => {
        await marketBehavior.authenticate(
          property1.address,
          "test-package1",
          "dummy-signature",
          "",
          "",
          "",
          market.address
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
        ).to.be.revertedWith("while pending");
      });
    });
  });
  describe("khaosCallback", () => {
    describe("success", () => {
      it("認証ができる", async () => {
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await marketBehavior.authenticate(
          property1.address,
          "test-package1",
          "dummy-signature",
          "",
          "",
          "",
          market.address
        );
        const data = getKhaosCallbackData(
          "test-package1",
          "dummy-signature",
          market.address,
          property1.address
        );
        const hash = getIdHash("test-package1");
        await expect(marketBehaviorKhaos.khaosCallback(data))
          .to.emit(marketBehavior, "Authenticated")
          .withArgs([
            hash,
            "test-package1",
            "dummy-signature",
            market.address,
            property1.address,
          ]);
        expect(await marketBehavior.getId(metrics.address)).to.equal(
          "test-package1"
        );
        expect(await marketBehavior.getMetrics("test-package1")).to.equal(
          metrics.address
        );
      });
    });
    describe("fail", () => {
      it("khaosのアドレスをセットしていないとエラー", async () => {
        await expect(marketBehavior.khaosCallback("0x01")).to.be.revertedWith(
          "illegal access"
        );
      });
      it("khaosのアドレスをセットしていてもkhaosが実行者じゃなければエラー", async () => {
        await marketBehavior.setKhaos(khaos.address);
        await expect(marketBehavior.khaosCallback("0x01")).to.be.revertedWith(
          "illegal access"
        );
      });
      it("pending中でなければエラー", async () => {
        const data = getKhaosCallbackData(
          "test-package1",
          "dummy-signature",
          market.address,
          property1.address
        );
        const marketBehaviorKhaos = marketBehavior.connect(khaos);
        await marketBehavior.setKhaos(khaos.address);
        await expect(
          marketBehaviorKhaos.khaosCallback(data)
        ).to.be.revertedWith("not while pending");
      });
    });
  });
});

function getIdHash(_package: string): string {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(_package));
  return hash;
}

function getKhaosCallbackData(
  _package: string,
  _signature: string,
  _marketAddress: string,
  _propertyAddress: string
): string {
  const hash = getIdHash(_package);
  const abi = new ethers.utils.AbiCoder();
  const data = abi.encode(
    ["tuple(bytes32, string, string, address, address)"],
    [[hash, _package, _signature, _marketAddress, _propertyAddress]]
  );
  return data;
}
