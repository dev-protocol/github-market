/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/functional-parameters */
/* eslint-disable functional/no-expression-statement */

import {ethers} from "ethers";
import * as githubmarket from "./../build/GitHubMarket.json";
require("dotenv").config();

const deploy = async (): Promise<void> => {
  const {NETWORK, INFURA_ID, MNEMONIC} = process.env;
  console.log(`network:${NETWORK}`);
  console.log(`infura id:${INFURA_ID}`);
  console.log(`mnemonic:${MNEMONIC}`);
  const provider = ethers.getDefaultProvider(NETWORK, {
    infura: INFURA_ID,
  });
  const wallet = ethers.Wallet.fromMnemonic(MNEMONIC!).connect(provider);
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
