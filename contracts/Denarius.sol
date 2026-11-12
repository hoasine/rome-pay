// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Denarius
/// @notice Send Rome's native USDC to any EVM address or Solana wallet, with memos,
///         one-time payment requests, and an on-chain history per address.
/// @dev A Solana wallet is paid at its Rome synthetic address, keccak256(pubkey)[12:],
///      which the wallet controls from Solflare without an EVM key. The contract never
///      holds funds after a call: every payment is forwarded in the same transaction.
contract Denarius {
    uint256 public constant MAX_PAGE_SIZE = 25;
    uint256 public constant MAX_TEXT_BYTES = 140;
    uint64 public constant MAX_REQUEST_DURATION = 90 days;

    struct Payment {
        address from;
        address to;
        uint256 amount;
        string memo;
        uint256 requestId;
        uint64 createdAt;
    }

    struct PaymentView {
        uint256 id;
        address from;
        address to;
        uint256 amount;
        string memo;
        uint256 requestId;
        uint64 createdAt;
    }

    struct Request {
        address recipient;
        uint256 amount;
        string note;
        uint64 createdAt;
        uint64 expiresAt;
        uint256 paymentId;
        bool cancelled;
    }

    struct RequestView {
        uint256 id;
        address recipient;
        uint256 amount;
        string note;
        uint64 createdAt;
        uint64 expiresAt;
        uint256 paymentId;
        bool cancelled;
    }

    error InvalidAmount();
    error InvalidExpiry();
    error InvalidRecipient();
    error LimitTooLarge();
    error NotRecipient();
    error PaymentNotFound();
    error ReentrantCall();
    error RequestClosed();
    error RequestExpired();
    error RequestNotFound();
    error TextTooLong();
    error TransferFailed();
    error WrongAmount();

    uint256 public paymentCount;
    uint256 public requestCount;

    mapping(uint256 => Payment) private _payments;
    mapping(uint256 => Request) private _requests;
    mapping(address => uint256[]) private _activity;
    uint256 private _unlocked = 1;

    event PaymentSent(
        uint256 indexed paymentId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 requestId,
        string memo
    );
    event RequestCreated(uint256 indexed requestId, address indexed recipient, uint256 amount, uint64 expiresAt);
    event RequestCancelled(uint256 indexed requestId);

    modifier nonReentrant() {
        if (_unlocked != 1) revert ReentrantCall();
        _unlocked = 2;
        _;
        _unlocked = 1;
    }

    function pay(address to, string calldata memo) external payable nonReentrant returns (uint256) {
        return _pay(to, memo, 0);
    }

    function createRequest(
        uint256 amount,
        string calldata note,
        uint64 expiresAt
    ) external returns (uint256 requestId) {
        if (amount == 0) revert InvalidAmount();
        if (bytes(note).length > MAX_TEXT_BYTES) revert TextTooLong();
        if (
            expiresAt != 0 &&
            (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_REQUEST_DURATION)
        ) revert InvalidExpiry();

        requestId = ++requestCount;
        _requests[requestId] = Request({
            recipient: msg.sender,
            amount: amount,
            note: note,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            paymentId: 0,
            cancelled: false
        });
        emit RequestCreated(requestId, msg.sender, amount, expiresAt);
    }

    function cancelRequest(uint256 requestId) external {
        Request storage request = _getRequest(requestId);
        if (request.recipient != msg.sender) revert NotRecipient();
        if (request.cancelled || request.paymentId != 0) revert RequestClosed();
        request.cancelled = true;
        emit RequestCancelled(requestId);
    }

    function payRequest(
        uint256 requestId,
        string calldata memo
    ) external payable nonReentrant returns (uint256 paymentId) {
        Request storage request = _getRequest(requestId);
        if (request.cancelled || request.paymentId != 0) revert RequestClosed();
        if (request.expiresAt != 0 && block.timestamp >= request.expiresAt) revert RequestExpired();
        if (msg.value != request.amount) revert WrongAmount();

        paymentId = paymentCount + 1;
        request.paymentId = paymentId;
        _pay(request.recipient, memo, requestId);
    }

    function getPayment(uint256 paymentId) public view returns (PaymentView memory) {
        Payment storage payment = _payments[paymentId];
        if (payment.from == address(0)) revert PaymentNotFound();
        return PaymentView({
            id: paymentId,
            from: payment.from,
            to: payment.to,
            amount: payment.amount,
            memo: payment.memo,
            requestId: payment.requestId,
            createdAt: payment.createdAt
        });
    }

    function getRequest(uint256 requestId) external view returns (RequestView memory) {
        Request storage request = _getRequest(requestId);
        return RequestView({
            id: requestId,
            recipient: request.recipient,
            amount: request.amount,
            note: request.note,
            createdAt: request.createdAt,
            expiresAt: request.expiresAt,
            paymentId: request.paymentId,
            cancelled: request.cancelled
        });
    }

    function activityCount(address account) external view returns (uint256) {
        return _activity[account].length;
    }

    /// @notice Payments sent or received by `account`, newest first.
    function paymentsOf(
        address account,
        uint256 offset,
        uint256 limit
    ) external view returns (PaymentView[] memory page) {
        if (limit > MAX_PAGE_SIZE) revert LimitTooLarge();
        uint256[] storage ids = _activity[account];
        if (offset >= ids.length || limit == 0) return new PaymentView[](0);
        uint256 size = ids.length - offset;
        if (size > limit) size = limit;
        page = new PaymentView[](size);
        for (uint256 index; index < size; index++) {
            page[index] = getPayment(ids[ids.length - 1 - offset - index]);
        }
    }

    function _pay(address to, string calldata memo, uint256 requestId) private returns (uint256 paymentId) {
        if (msg.value == 0) revert InvalidAmount();
        if (to == address(0) || to == msg.sender || to == address(this)) revert InvalidRecipient();
        if (bytes(memo).length > MAX_TEXT_BYTES) revert TextTooLong();

        paymentId = ++paymentCount;
        _payments[paymentId] = Payment({
            from: msg.sender,
            to: to,
            amount: msg.value,
            memo: memo,
            requestId: requestId,
            createdAt: uint64(block.timestamp)
        });
        _activity[msg.sender].push(paymentId);
        _activity[to].push(paymentId);
        emit PaymentSent(paymentId, msg.sender, to, msg.value, requestId, memo);

        (bool success, ) = to.call{value: msg.value}("");
        if (!success) revert TransferFailed();
    }

    function _getRequest(uint256 requestId) private view returns (Request storage request) {
        request = _requests[requestId];
        if (request.recipient == address(0)) revert RequestNotFound();
    }
}
