// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {JsmnSolLib} from "contracts/lib/JsmnSolLib.sol";

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
        string publicSignature;
        string additionalData;
    }

    struct AuthenticatedData {
        bytes32 key;
        string additionalData;
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
            _publicSignature,
            strConcat("{\"property\":\"", convertAddresstoString(_prop), "\", \"package\":\"", _githubPackage, "\"}")
        );
        emit Query(d);

        pendingAuthentication[key] = true;

        if (market == address(0)) {
            market = _dest;
        }
        return true;
    }

    function strConcat(
        string memory _a,
        string memory _b,
        string memory _c,
        string memory _d,
        string memory _e
    ) private pure returns (string memory){
        bytes memory _ba = bytes(_a);
        bytes memory _bb = bytes(_b);
        bytes memory _bc = bytes(_c);
        bytes memory _bd = bytes(_d);
        bytes memory _be = bytes(_e);
        string memory abcde = new string(_ba.length + _bb.length + _bc.length + _bd.length + _be.length);
        bytes memory babcde = bytes(abcde);
        uint k = 0;
        for (uint i = 0; i < _ba.length; i++) babcde[k++] = _ba[i];
        for (uint i = 0; i < _bb.length; i++) babcde[k++] = _bb[i];
        for (uint i = 0; i < _bc.length; i++) babcde[k++] = _bc[i];
        for (uint i = 0; i < _bd.length; i++) babcde[k++] = _bd[i];
        for (uint i = 0; i < _be.length; i++) babcde[k++] = _be[i];
        return string(babcde);
    }

    function convertAddresstoString(address account) private pure returns(string memory) {
        bytes memory data = abi.encodePacked(account);
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint i = 0; i < data.length; i++) {
            str[2+i*2] = alphabet[uint(uint8(data[i] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }

    function khaosCallback(bytes memory _data) external {
        require(msg.sender == khaos, "illegal access");
        AuthenticatedData memory callback = abi.decode(
            _data,
            (AuthenticatedData)
        );
        require(pendingAuthentication[callback.key], "not while pending");
        emit Authenticated(callback);
        delete pendingAuthentication[callback.key];
        (JsmnSolLib.Token[] memory tokens, uint actualNum) = parseJson(callback.additionalData);
        (
            uint status,
            address property,
            string memory package,
            string memory errorMessage
        ) = getAdditionalData(callback.additionalData, tokens, actualNum);
        require(status == 0, errorMessage);

        register(callback.key, property, package);
    }

    function parseJson(string memory json) private pure returns (JsmnSolLib.Token[] memory, uint) {
        uint returnValue;
        uint actualNum;
        JsmnSolLib.Token[] memory tokens;

        (returnValue, tokens, actualNum) = JsmnSolLib.parse(json, 10);
        require(returnValue == JsmnSolLib.RETURN_SUCCESS, "parce error");
        return (tokens, actualNum);
    }

    function getAdditionalData(
        string memory json,
        JsmnSolLib.Token[] memory tokens,
        uint actualNum
    ) private pure returns (uint, address, string memory, string memory) {
        string memory jsonElement;
        JsmnSolLib.Token memory t;
        uint status;
        string memory errorMessage;
        string memory package;
        address property;

        for(uint ielement=0; ielement < actualNum-1; ielement++) {
            t = tokens[ielement];
            jsonElement = JsmnSolLib.getBytes(json, t.start, t.end);
            if(compareStrings(jsonElement, "status")) {
                t = tokens[ielement+1];
                status = parseInt(JsmnSolLib.getBytes(json, t.start, t.end));
            } else if(compareStrings(jsonElement, "errorMessage")) {
                t = tokens[ielement+1];
                errorMessage = JsmnSolLib.getBytes(json, t.start, t.end);
            } else if(compareStrings(jsonElement, "package")) {
                t = tokens[ielement+1];
                package = JsmnSolLib.getBytes(json, t.start, t.end);
            } else if(compareStrings(jsonElement, "property")) {
                t = tokens[ielement+1];
                property = parseAddr(JsmnSolLib.getBytes(json, t.start, t.end));
            }
        }
        return (status, property, package, errorMessage);
    }

    function parseInt(string memory _value)
        private
        pure
        returns (uint _ret) {
        bytes memory _bytesValue = bytes(_value);
        uint j = 1;
        for(uint i = _bytesValue.length-1; i >= 0 && i < _bytesValue.length; i--) {
            assert(uint8(_bytesValue[i]) >= 48 && uint8(_bytesValue[i]) <= 57);
            _ret += (uint8(_bytesValue[i]) - 48)*j;
            j*=10;
        }
    }

    function parseAddr(string memory _a) internal pure returns (address _parsedAddress) {
        bytes memory tmp = bytes(_a);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 65) && (b1 <= 70)) {
                b1 -= 55;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 65) && (b2 <= 70)) {
                b2 -= 55;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }

    function compareStrings (string memory a, string memory b) private pure returns (bool){
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
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
        if (market == address(0)) {
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
