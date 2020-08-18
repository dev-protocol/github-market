// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IMarketBehavior {
    function authenticate(
        address _prop,
        string calldata _args1,
        string calldata _args2,
        string calldata _args3,
        string calldata _args4,
        string calldata _args5,
        address market
    )
        external
        returns (
            // solium-disable-next-line indentation
            bool
        );

    function schema() external view returns (string memory);

    function getId(address _metrics) external view returns (string memory);

    function getMetrics(string calldata _id) external view returns (address);
}

interface IMarket {
    function authenticate(
        address _prop,
        string calldata _args1,
        string calldata _args2,
        string calldata _args3,
        string calldata _args4,
        string calldata _args5
    )
        external
        returns (
            // solium-disable-next-line indentation
            bool
        );

    function authenticatedCallback(address _property, bytes32 _idHash)
        external
        returns (address);

    function deauthenticate(address _metrics) external;

    function schema() external view returns (string memory);

    function behavior() external view returns (address);

    function enabled() external view returns (bool);

    function votingEndBlockNumber() external view returns (uint256);

    function toEnable() external;
}

contract GitHubMarket is IMarketBehavior, Ownable {
    address private khaos;
    address private market;
    bool public migratable = true;

    mapping(address => string) private packages;
    mapping(bytes32 => address) private metrics;
    mapping(bytes32 => bool) private pendingAuthentication;
    event Registered(address _metrics, string _package);
    event Authenticated(AuthenticatedData _data);
    event Query(QueryData _data);
    struct QueryData {
        bytes32 key;
        string package;
        string publicSignature;
        address property;
    }

    struct AuthenticatedData {
        bytes32 key;
        string package;
        address property;
        int status;
        string errorMessage;
    }

    /*
    _githubPackage: ex)
                        personal repository: Akira-Taniguchi/cloud_lib
                        organization repository: dev-protocol/protocol
    _publicSignature: signature string(created by Khaos)
    */
    function authenticate(
        address _prop,
        string memory _githubPackage,
        string memory _publicSignature,
        string memory,
        string memory,
        string memory,
        address _dest
    ) public override returns (bool) {
        bytes32 key = createKey(_githubPackage);
        require(pendingAuthentication[key] == false, "while pending");
        QueryData memory d = QueryData(
            key,
            _githubPackage,
            _publicSignature,
            _prop
        );
        emit Query(d);

        pendingAuthentication[key] = true;

        if (market == address(0)){
            market = _dest;
        }
        return true;
    }

    function khaosCallback(bytes memory _data) external {
        require(msg.sender == khaos, "illegal access");
        AuthenticatedData memory callback = abi.decode(_data, (AuthenticatedData));
        require(pendingAuthentication[callback.key], "not while pending");
        emit Authenticated(callback);
        delete pendingAuthentication[callback.key];
        require(callback.status == 0, callback.errorMessage);

        register(
            callback.key,
            callback.property,
            callback.package
        );
    }

    function register(
        bytes32 _key,
        address _property,
        string memory _package
    ) private {
        address _metrics = IMarket(market).authenticatedCallback(
            _property,
            _key
        );
        packages[_metrics] = _package;
        metrics[_key] = _metrics;
        emit Registered(_metrics, _package);
    }

    function createKey(string memory _package) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_package));
    }

    function getId(address _metrics)
        public
        override
        view
        returns (string memory)
    {
        return packages[_metrics];
    }

    function getMetrics(string memory _package)
        public
        override
        view
        returns (address)
    {
        return metrics[createKey(_package)];
    }

    function migrate(
        address _property,
        string memory _package,
        address _market
    ) public onlyOwner {
        if (market == address(0)){
            market = _market;
        }
        bytes32 key = createKey(_package);
        require(migratable, "now is not migratable");
        register(key, _property, _package);
    }

    function done() public onlyOwner {
        migratable = false;
    }

    function setKhaos(address _khaos) external onlyOwner {
        khaos = _khaos;
    }

    function schema() external override view returns (string memory) {
        return "['GitHub package', 'GitHub token']";
    }
}
