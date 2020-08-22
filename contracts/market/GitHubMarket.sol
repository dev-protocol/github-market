// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.6.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/cryptography/ECDSA.sol";

interface IMarketBehavior {
    function authenticate(
        address _prop,
        string calldata _args1,
        string calldata _args2,
        string calldata _args3,
        string calldata _args4,
        string calldata _args5,
        address market,
        address account
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
    using ECDSA for bytes32;
    address private khaos;
    bool public migratable = true;
    bool public priorApproved = true;
    string constant khaosId = "github-market";

    mapping(address => string) private repositories;
    mapping(bytes32 => address) private metrics;
    mapping(bytes32 => address) private properties;
    mapping(bytes32 => address) private markets;
    mapping(bytes32 => bool) private pendingAuthentication;
    mapping(bytes32 => bool) private authenticationed;
    mapping(string => bool) private publicSignatures;
    event Registered(address _metrics, string _repository);
    event Authenticated(string _repository, uint256 _status, string message);
    event Query(string publicSignature);

    struct AuthenticatedData {
        string package;
        uint256 status;
        string message;
    }

    /*
    _githubRepository: ex)
                        personal repository: Akira-Taniguchi/cloud_lib
                        organization repository: dev-protocol/protocol
    _publicSignature: signature string(created by Khaos)
    */
    function authenticate(
        address _prop,
        string memory _githubRepository,
        string memory _publicSignature,
        string memory,
        string memory,
        string memory,
        address _dest,
        address
    ) public override returns (bool) {
        if (priorApproved) {
            require(
                publicSignatures[_publicSignature],
                "It has not been approved."
            );
        }
        bytes32 key = createKey(_githubRepository);
        require(authenticationed[key] == false, "already authinticated");
        emit Query(_publicSignature);
        properties[key] = _prop;
        markets[key] = _dest;
        pendingAuthentication[key] = true;
        return true;
    }

    function khaosCallback(
        string memory _githubRepository,
        uint256 _status,
        string memory message
    ) external {
        require(msg.sender == khaos, "illegal access");
        require(_status == 0, message);
        bytes32 key = createKey(_githubRepository);
        require(pendingAuthentication[key], "not while pending");
        emit Authenticated(_githubRepository, _status, message);
        authenticationed[key] = true;
        register(key, _githubRepository, markets[key], properties[key]);
    }

    function register(
        bytes32 _key,
        string memory _repository,
        address _market,
        address _property
    ) private {
        address _metrics = IMarket(_market).authenticatedCallback(
            _property,
            _key
        );
        repositories[_metrics] = _repository;
        metrics[_key] = _metrics;
        emit Registered(_metrics, _repository);
    }

    function createKey(string memory _repository)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_repository));
    }

    function getId(address _metrics)
        public
        override
        view
        returns (string memory)
    {
        return repositories[_metrics];
    }

    function getMetrics(string memory _repository)
        public
        override
        view
        returns (address)
    {
        return metrics[createKey(_repository)];
    }

    function migrate(
        string memory _repository,
        address _market,
        address _property
    ) public onlyOwner {
        require(migratable, "now is not migratable");
        bytes32 key = createKey(_repository);
        register(key, _repository, _market, _property);
    }

    function done() public onlyOwner {
        migratable = false;
    }

    function setpriorApprovedMode(bool _value) public onlyOwner {
        priorApproved = _value;
    }

    function addPublicSignaturee(string memory _publicSignature)
        public
        onlyOwner
    {
        publicSignatures[_publicSignature] = true;
    }

    function setKhaos(address _khaos) external onlyOwner {
        khaos = _khaos;
    }

    function schema() external override view returns (string memory) {
        return "['GitHub repository', 'GitHub token']";
    }
}
