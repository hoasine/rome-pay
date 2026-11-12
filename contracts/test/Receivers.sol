// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRomePay {
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
    IRomePay public immutable romepay;
    address public immutable target;

    constructor(address romepayAddress, address targetAddress) payable {
        romepay = IRomePay(romepayAddress);
        target = targetAddress;
    }

    receive() external payable {
        romepay.pay{value: msg.value}(target, "re-enter");
    }
}
