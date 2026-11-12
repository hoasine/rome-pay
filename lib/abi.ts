const paymentComponents = [
  { name: "id", type: "uint256" },
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "amount", type: "uint256" },
  { name: "memo", type: "string" },
  { name: "requestId", type: "uint256" },
  { name: "createdAt", type: "uint64" },
] as const;

export const denariusAbi = [
  {
    type: "function",
    name: "paymentCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "requestCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pay",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "memo", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "note", type: "string" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "requestId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelRequest",
    stateMutability: "nonpayable",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "payRequest",
    stateMutability: "payable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "memo", type: "string" },
    ],
    outputs: [{ name: "paymentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getPayment",
    stateMutability: "view",
    inputs: [{ name: "paymentId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: paymentComponents }],
  },
  {
    type: "function",
    name: "getRequest",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "note", type: "string" },
          { name: "createdAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
          { name: "paymentId", type: "uint256" },
          { name: "cancelled", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "activityCount",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "paymentsOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "page", type: "tuple[]", components: paymentComponents }],
  },
] as const;
