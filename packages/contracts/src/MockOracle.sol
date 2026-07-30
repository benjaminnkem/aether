// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { AccessControl } from "openzeppelin-contracts/access/AccessControl.sol";

import { IArcadiaOracle } from "./interfaces/IArcadiaOracle.sol";

/// @notice Timestamp-only oracle fixture. It has no pricing or token-economic behavior.
contract MockOracle is AccessControl, IArcadiaOracle {
    bytes32 public constant FIXTURE_ADMIN_ROLE = keccak256("FIXTURE_ADMIN_ROLE");

    event FreshnessUpdated(uint256 previousUpdatedAt, uint256 newUpdatedAt, address indexed actor);

    error InvalidFixtureAdmin();

    uint256 public lastUpdatedAt;

    constructor(address fixtureAdmin, uint256 initialUpdatedAt) {
        if (fixtureAdmin == address(0)) revert InvalidFixtureAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, fixtureAdmin);
        _grantRole(FIXTURE_ADMIN_ROLE, fixtureAdmin);
        lastUpdatedAt = initialUpdatedAt;
    }

    function setUpdatedAt(uint256 updatedAt) external onlyRole(FIXTURE_ADMIN_ROLE) {
        uint256 previous = lastUpdatedAt;
        lastUpdatedAt = updatedAt;
        emit FreshnessUpdated(previous, updatedAt, msg.sender);
    }

    function touch() external onlyRole(FIXTURE_ADMIN_ROLE) {
        uint256 previous = lastUpdatedAt;
        lastUpdatedAt = block.timestamp;
        emit FreshnessUpdated(previous, block.timestamp, msg.sender);
    }
}
