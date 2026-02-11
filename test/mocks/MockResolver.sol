// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockResolver {
    mapping(bytes32 => mapping(string => string)) public texts;
    mapping(bytes32 => address) public addrs;
    mapping(bytes32 => bytes) public contenthashes;

    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }

    function setAddr(bytes32 node, address a) external {
        addrs[node] = a;
    }

    function setContenthash(bytes32 node, bytes calldata hash) external {
        contenthashes[node] = hash;
    }
}
