// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IAccessControl } from "openzeppelin-contracts/access/IAccessControl.sol";

import { ArcadiaTestBase } from "./ArcadiaTestBase.sol";
import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";

contract ArcadiaLifecycleTest is ArcadiaTestBase {
    function test_UnauthorizedDesiredStateDriftAndExactCorrection() public {
        address desiredOracle = address(approvedOracle);
        uint256 evidenceBlock = block.number;
        bytes32 evidenceBlockHash = blockhash(block.number - 1);

        vm.prank(driftActor);
        market.setOracle(address(unauthorizedOracle));
        assertNotEq(market.oracle(), desiredOracle);
        assertEq(block.number, evidenceBlock);
        assertEq(blockhash(block.number - 1), evidenceBlockHash);

        bytes memory exactRequest =
            abi.encodeCall(ArcadiaMarket.setOracle, (address(approvedOracle)));
        assertEq(
            exactRequest,
            abi.encodePacked(
                bytes4(keccak256("setOracle(address)")),
                bytes32(uint256(uint160(address(approvedOracle))))
            )
        );
        vm.prank(executor);
        (bool success,) = address(market).call(exactRequest);
        assertTrue(success);
        assertEq(market.oracle(), desiredOracle);
        assertTrue(market.isOracleFresh());
    }

    function test_MissingRoleSimulationFailsBeforeSubmission() public {
        bytes memory exactRequest =
            abi.encodeCall(ArcadiaMarket.setOracle, (address(approvedOracle)));
        vm.prank(outsider);
        (bool success, bytes memory revertData) = address(market).call(exactRequest);
        assertFalse(success);
        assertGe(revertData.length, 4);
        // Safe after the length assertion; only the custom-error selector is inspected.
        // forge-lint: disable-next-line(unsafe-typecast)
        assertEq(bytes4(revertData), IAccessControl.AccessControlUnauthorizedAccount.selector);
        assertEq(market.oracle(), address(approvedOracle));
    }

    function test_ConfirmedWriteCanRequireForwardCorrection() public {
        vm.prank(driftActor);
        market.setOracle(address(unauthorizedOracle));

        vm.prank(admin);
        approvedOracle.setUpdatedAt(block.timestamp - MAX_ORACLE_AGE - 1);
        vm.prank(executor);
        market.setOracle(address(approvedOracle));

        assertEq(market.oracle(), address(approvedOracle));
        assertFalse(market.isOracleFresh(), "confirmed pointer write is not verified success");

        vm.prank(admin);
        approvedOracle.touch();
        assertEq(market.oracle(), address(approvedOracle), "no rollback was performed");
        assertTrue(market.isOracleFresh(), "forward correction restores invariant");
    }
}
