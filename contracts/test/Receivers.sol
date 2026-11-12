// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IDenarius {
    function pay(address to, string calldata memo) external payable returns (uint256);
}

/// @dev Test-only recipient that refuses every payment.
contract RejectingReceiver {
    receive() external payable {
        revert("no thanks");
    }
}

/// @dev Test-only recipient that tries to pay again from inside the transfer.
contract ReentrantReceiver {
    IDenarius public immutable denarius;
    address public immutable target;

    constructor(address denariusAddress, address targetAddress) payable {
        denarius = IDenarius(denariusAddress);
        target = targetAddress;
    }

    receive() external payable {
        denarius.pay{value: msg.value}(target, "re-enter");
    }
}
