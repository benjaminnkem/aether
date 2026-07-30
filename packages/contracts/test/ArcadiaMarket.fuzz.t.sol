// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ArcadiaTestBase } from "./ArcadiaTestBase.sol";
import { ERC1967Proxy } from "openzeppelin-contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";
import { MockOracle } from "../src/MockOracle.sol";

contract ArcadiaMarketFuzzTest is ArcadiaTestBase {
    function testFuzz_FreshnessBoundary(uint32 age, uint32 maxAge) public {
        maxAge = uint32(bound(maxAge, 1, 30 days));
        age = uint32(bound(age, 0, 60 days));

        approvedOracle = new MockOracle(admin, block.timestamp - age);
        implementation = new ArcadiaMarket();
        market = ArcadiaMarket(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        ArcadiaMarket.initialize,
                        (admin, executor, driftActor, address(approvedOracle), uint256(maxAge))
                    )
                )
            )
        );

        assertEq(market.isOracleFresh(), age <= maxAge);
    }

    function testFuzz_AuthorizedSetOracleAlwaysUsesContractAddress(uint8 seed) public {
        MockOracle candidate = seed % 2 == 0 ? approvedOracle : unauthorizedOracle;
        vm.prank(executor);
        market.setOracle(address(candidate));
        assertEq(market.oracle(), address(candidate));
        assertGt(market.oracle().code.length, 0);
    }
}
