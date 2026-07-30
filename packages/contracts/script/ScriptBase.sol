// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";

abstract contract ScriptBase is Script {
    uint256 internal constant LOCAL_ANVIL_CHAIN_ID = 31_337;
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84_532;

    error UnsupportedChain(uint256 chainId);
    error DeploymentChainMismatch(uint256 expected, uint256 actual);

    struct Deployment {
        address implementation;
        address marketProxy;
        address approvedOracle;
        address unauthorizedOracle;
        address admin;
        address executor;
        address driftActor;
        address fixtureAdmin;
        uint256 maxOracleAge;
    }

    function _requireSupportedChain() internal view {
        if (block.chainid != LOCAL_ANVIL_CHAIN_ID && block.chainid != BASE_SEPOLIA_CHAIN_ID) {
            revert UnsupportedChain(block.chainid);
        }
    }

    function _deploymentPath() internal view returns (string memory) {
        return string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
    }

    function _readDeployment() internal view returns (Deployment memory deployment) {
        string memory json = vm.readFile(_deploymentPath());
        uint256 recordedChainId = vm.parseJsonUint(json, ".chainId");
        if (recordedChainId != block.chainid) {
            revert DeploymentChainMismatch(recordedChainId, block.chainid);
        }
        deployment = Deployment({
            implementation: vm.parseJsonAddress(json, ".implementation"),
            marketProxy: vm.parseJsonAddress(json, ".marketProxy"),
            approvedOracle: vm.parseJsonAddress(json, ".approvedOracle"),
            unauthorizedOracle: vm.parseJsonAddress(json, ".unauthorizedOracle"),
            admin: vm.parseJsonAddress(json, ".admin"),
            executor: vm.parseJsonAddress(json, ".executor"),
            driftActor: vm.parseJsonAddress(json, ".driftActor"),
            fixtureAdmin: vm.parseJsonAddress(json, ".fixtureAdmin"),
            maxOracleAge: vm.parseJsonUint(json, ".maxOracleAge")
        });
    }
}
