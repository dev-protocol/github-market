/* eslint-disable functional/functional-parameters */
/* eslint-disable functional/no-expression-statement */

import {ethers} from "ethers";
import * as githubmarket from "./../build/GitHubMarket.json";

const deploy = async (): Promise<void> => {
  /////////////////////////////////////
  const network = "";
  const infuraId = "";
  const mnemonic = "";
  /////////////////////////////////////

  const provider = ethers.getDefaultProvider(network, {
    infura: infuraId,
  });
  const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
  const factory = new ethers.ContractFactory(
    githubmarket.abi,
    githubmarket.bytecode,
    wallet
  );
  const contract = await factory.deploy();
  await contract.deployed();
  console.log(contract.address);
};

void deploy();
