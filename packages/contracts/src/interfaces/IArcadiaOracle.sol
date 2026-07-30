// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IArcadiaOracle {
    function lastUpdatedAt() external view returns (uint256);
}
