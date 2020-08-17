// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.6.0;
import {IMarket} from "contracts/GitHubMarket.sol";

contract MockMarket is IMarket {
    address public latestMetrics;
    function authenticate(
        address ,
        string memory ,
        string memory ,
        string memory,
        string memory,
        string memory
    ) external override returns (bool) {
        return true;
    }

    function setLatestMetrics(address _metrics) external {
        latestMetrics = _metrics;
    }

    function authenticatedCallback(address , bytes32 ) external override returns (address) {
        return latestMetrics;
    }

    function deauthenticate(
        address 
    ) external override {}

    function schema() external override view returns (string memory) {
        return "";
    }

    function behavior() external override view returns (address) {
        return address(0);
    }

    function enabled() external override view returns (bool) {
        return true;
    }

    function votingEndBlockNumber() external override view returns (uint256) {
        return 0;
    }

    function toEnable() external override {

    }
}
