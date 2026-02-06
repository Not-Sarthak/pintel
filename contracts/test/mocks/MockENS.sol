// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockENS {
    mapping(bytes32 => address) public owners;

    function setSubnodeRecord(bytes32 node, bytes32 label, address _owner, address, uint64) external {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        owners[subnode] = _owner;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }

    function setOwner(bytes32 node, address _owner) external {
        owners[node] = _owner;
    }
}
