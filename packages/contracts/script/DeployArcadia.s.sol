// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC1967Proxy } from "openzeppelin-contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";
import { MockOracle } from "../src/MockOracle.sol";
import { ScriptBase } from "./ScriptBase.sol";

contract DeployArcadia is ScriptBase {
    uint256 internal constant DEFAULT_MAX_ORACLE_AGE = 1 hours;

    function run() external returns (Deployment memory deployment) {
        _requireSupportedChain();

        address admin = vm.envOr("AETHER_CONTRACT_ADMIN_ADDRESS", tx.origin);
        address executor = vm.envOr(
            "AETHER_EXECUTOR_ADDRESS", address(0xA11CE00000000000000000000000000000000002)
        );
        address driftActor = vm.envOr(
            "AETHER_DRIFT_ACTOR_ADDRESS", address(0xA11Ce00000000000000000000000000000000003)
        );
        address fixtureAdmin = vm.envOr(
            "AETHER_FIXTURE_ADMIN_ADDRESS", address(0xa11CE00000000000000000000000000000000004)
        );
        uint256 maxOracleAge = vm.envOr("AETHER_MAX_ORACLE_AGE", DEFAULT_MAX_ORACLE_AGE);

        vm.startBroadcast();
        MockOracle approvedOracle = new MockOracle(fixtureAdmin, block.timestamp);
        MockOracle unauthorizedOracle = new MockOracle(fixtureAdmin, block.timestamp);
        ArcadiaMarket implementation = new ArcadiaMarket();
        bytes memory initialization = abi.encodeCall(
            ArcadiaMarket.initialize,
            (admin, executor, driftActor, address(approvedOracle), maxOracleAge)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initialization);
        vm.stopBroadcast();

        deployment = Deployment({
            implementation: address(implementation),
            marketProxy: address(proxy),
            approvedOracle: address(approvedOracle),
            unauthorizedOracle: address(unauthorizedOracle),
            admin: admin,
            executor: executor,
            driftActor: driftActor,
            fixtureAdmin: fixtureAdmin,
            maxOracleAge: maxOracleAge
        });
        if (vm.envOr("AETHER_RECORD_DEPLOYMENT", false)) {
            _writeDeployment(deployment);
        }
    }

    function _writeDeployment(Deployment memory deployment) internal {
        string memory object = "deployment";
        vm.serializeUint(object, "chainId", block.chainid);
        vm.serializeAddress(object, "implementation", deployment.implementation);
        vm.serializeAddress(object, "marketProxy", deployment.marketProxy);
        vm.serializeAddress(object, "approvedOracle", deployment.approvedOracle);
        vm.serializeAddress(object, "unauthorizedOracle", deployment.unauthorizedOracle);
        vm.serializeAddress(object, "admin", deployment.admin);
        vm.serializeAddress(object, "executor", deployment.executor);
        vm.serializeAddress(object, "driftActor", deployment.driftActor);
        vm.serializeAddress(object, "fixtureAdmin", deployment.fixtureAdmin);
        vm.serializeUint(object, "maxOracleAge", deployment.maxOracleAge);
        string memory json = vm.serializeBool(object, "deployed", true);
        vm.writeJson(json, _deploymentPath());
    }
}
