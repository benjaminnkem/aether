// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { AccessControl } from "openzeppelin-contracts/access/AccessControl.sol";

import { IArcadiaOracle } from "./interfaces/IArcadiaOracle.sol";

/// @title ArcadiaMarket
/// @notice Access-controlled, value-free fixture for the reduced Aether MVP only.
/// @dev This contract is unaudited and must never custody real assets.
contract ArcadiaMarket is AccessControl {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");

    error InvalidAddress();
    error AlreadyInitialized();
    error InvalidMaxOracleAge();
    error OracleHasNoCode(address oracle);

    event OracleConfigured(
        address indexed previousOracle, address indexed newOracle, address indexed actor
    );

    address public oracle;
    uint256 public maxOracleAge;
    bool private _initialized;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _initialized = true;
    }

    function initialize(
        address admin,
        address oracleAdmin,
        address driftOracleAdmin,
        address approvedOracle,
        uint256 maximumOracleAge
    ) external {
        if (_initialized) revert AlreadyInitialized();
        if (
            admin == address(0) || oracleAdmin == address(0) || driftOracleAdmin == address(0)
                || approvedOracle == address(0)
        ) {
            revert InvalidAddress();
        }
        if (approvedOracle.code.length == 0) revert OracleHasNoCode(approvedOracle);
        if (maximumOracleAge == 0) revert InvalidMaxOracleAge();

        _initialized = true;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, oracleAdmin);
        _grantRole(ORACLE_ADMIN_ROLE, driftOracleAdmin);
        oracle = approvedOracle;
        maxOracleAge = maximumOracleAge;

        emit OracleConfigured(address(0), approvedOracle, oracleAdmin);
    }

    function setOracle(address newOracle) external onlyRole(ORACLE_ADMIN_ROLE) {
        if (newOracle == address(0)) revert InvalidAddress();
        if (newOracle.code.length == 0) revert OracleHasNoCode(newOracle);
        address previousOracle = oracle;
        oracle = newOracle;
        emit OracleConfigured(previousOracle, newOracle, msg.sender);
    }

    function oracleStatus()
        public
        view
        returns (address configuredOracle, uint256 updatedAt, bool fresh)
    {
        configuredOracle = oracle;
        try IArcadiaOracle(configuredOracle).lastUpdatedAt() returns (uint256 observedAt) {
            updatedAt = observedAt;
            // Validator timestamp latitude is acceptable for this coarse freshness window.
            // forge-lint: disable-next-line(block-timestamp)
            fresh = observedAt <= block.timestamp && block.timestamp - observedAt <= maxOracleAge;
        } catch {
            fresh = false;
        }
    }

    function isOracleFresh() external view returns (bool) {
        (,, bool fresh) = oracleStatus();
        return fresh;
    }
}
