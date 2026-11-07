// Route / token config mirrored EXACTLY from https://bridge.zaphod.one/api/state
// fetched live on 2026-11-07 (api/state generatedAt 2026-10-23T08:17:11.247Z).
// Do not hand-edit addresses: re-fetch /api/state and regenerate.
export const STATE = {
 "generatedAt": "2026-10-23T08:17:11.247Z",
 "chains": {
  "bsc": {
   "key": "bsc",
   "name": "BNB Smart Chain",
   "short": "BSC",
   "chainId": 56,
   "hex": "0x38",
   "domain": 56,
   "rpc": "https://bsc-rpc.publicnode.com",
   "walletRpcUrls": [
    "https://bsc-rpc.publicnode.com",
    "https://bnb.api.onfinality.io/public"
   ],
   "scan": "https://bscscan.com",
   "mailbox": "0x2971b9Aec44bE4eb673DF1B88cDB57b96eefe8a4",
   "native": {
    "symbol": "BNB",
    "decimals": 18
   },
   "legacyGasPrice": null
  },
  "infinite": {
   "key": "infinite",
   "name": "Infinite Drive",
   "short": "IID",
   "chainId": 421018,
   "hex": "0x66c9a",
   "domain": 421018,
   "rpc": "https://evm.infinitedrive.xyz",
   "walletRpcUrls": [
    "https://evm.infinitedrive.xyz",
    "https://evm-rpc-infinite.mschihuahua.org",
    "https://evm-rpc.infinitedrive.xyz"
   ],
   "scan": "https://scan.infinitedrive.xyz",
   "mailbox": "0xac70cdD7F2B712AEF7A20661e0c2E96E1Da1d63E",
   "native": {
    "symbol": "[42]",
    "decimals": 18
   },
   "legacyGasPrice": null
  },
  "ethereum": {
   "key": "ethereum",
   "name": "Ethereum",
   "short": "ETH",
   "chainId": 1,
   "hex": "0x1",
   "domain": 1,
   "rpc": "https://eth.drpc.org",
   "walletRpcUrls": [
    "https://eth.drpc.org",
    "https://ethereum-rpc.publicnode.com"
   ],
   "scan": "https://etherscan.io",
   "mailbox": "0xc005dc82818d67AF737725bD4bf75435d065D239",
   "native": {
    "symbol": "ETH",
    "decimals": 18
   },
   "legacyGasPrice": null
  },
  "ql1": {
   "key": "ql1",
   "name": "QL1",
   "short": "QL1",
   "chainId": 766,
   "hex": "0x2fe",
   "domain": 766,
   "rpc": "https://evm-rpc-ql1.foxxone.one",
   "walletRpcUrls": [
    "https://evm-rpc-ql1.foxxone.one",
    "https://scan.qom.network/api/eth-rpc"
   ],
   "scan": "https://scan.qom.network",
   "mailbox": "0x2f136BaA37Eb5711483D295944EeDa01c4142dA0",
   "native": {
    "symbol": "QOM",
    "decimals": 18
   },
   "legacyGasPrice": "18000000000000000000"
  }
 },
 "routes": [
  {
   "from": "bsc",
   "to": "infinite",
   "tokens": [
    {
     "key": "USDT",
     "name": "USDT",
     "src": {
      "chain": "bsc",
      "kind": "collateral",
      "router": "0x8612Ed09749fBE0416bd11D0f37bC391Cf8a1eB2",
      "bridgeRouter": "0x2f136BaA37Eb5711483D295944EeDa01c4142dA0",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 18,
      "erc20": "0x55d398326f99059fF775485246999027B3197955"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xaf16100C917a221A786C5B3dC2cB270f9DcfD447",
      "bridgeRouter": "0x8667682B62CacedA9e87B3CAA21D5B09D9Ae13c3",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 18,
      "erc20": "0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     }
    },
    {
     "key": "USDC",
     "name": "USDC",
     "src": {
      "chain": "bsc",
      "kind": "collateral",
      "router": "0x54718De5e064DcD1181b7847591c5864434ED92e",
      "bridgeRouter": "0x4F69A9cF19C7B291b1A2A5dA30B8Ce873d7849fa",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 18,
      "erc20": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xe20C0c642c2841EBe1375770Aa8A1b888Ce1688A",
      "bridgeRouter": "0xCDbf8dA81F0a24f25Bcd23c6232704BBfA410bd4",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 18,
      "erc20": "0xea5b7fD59b7ec0F34663835A3a361F469C2D4c5C",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     }
    }
   ]
  },
  {
   "from": "infinite",
   "to": "bsc",
   "tokens": [
    {
     "key": "USDT",
     "name": "USDT",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xaf16100C917a221A786C5B3dC2cB270f9DcfD447",
      "bridgeRouter": "0x8667682B62CacedA9e87B3CAA21D5B09D9Ae13c3",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 18,
      "erc20": "0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     },
     "dst": {
      "chain": "bsc",
      "kind": "collateral",
      "router": "0x8612Ed09749fBE0416bd11D0f37bC391Cf8a1eB2",
      "bridgeRouter": "0x2f136BaA37Eb5711483D295944EeDa01c4142dA0",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 18,
      "erc20": "0x55d398326f99059fF775485246999027B3197955"
     }
    },
    {
     "key": "USDC",
     "name": "USDC",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xe20C0c642c2841EBe1375770Aa8A1b888Ce1688A",
      "bridgeRouter": "0xCDbf8dA81F0a24f25Bcd23c6232704BBfA410bd4",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 18,
      "erc20": "0xea5b7fD59b7ec0F34663835A3a361F469C2D4c5C",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     },
     "dst": {
      "chain": "bsc",
      "kind": "collateral",
      "router": "0x54718De5e064DcD1181b7847591c5864434ED92e",
      "bridgeRouter": "0x4F69A9cF19C7B291b1A2A5dA30B8Ce873d7849fa",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 18,
      "erc20": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
     }
    }
   ]
  },
  {
   "from": "ethereum",
   "to": "infinite",
   "tokens": [
    {
     "key": "USDT",
     "name": "USDT",
     "src": {
      "chain": "ethereum",
      "kind": "collateral",
      "router": "0xA0407f73C16776cA60584cCa9a4B15d96376E188",
      "bridgeRouter": "0x56d962fD360bA872115e77E3316909037bfB7E7E",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 6,
      "erc20": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "feeBps": 0
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xaf16100C917a221A786C5B3dC2cB270f9DcfD447",
      "bridgeRouter": "0x8667682B62CacedA9e87B3CAA21D5B09D9Ae13c3",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 18,
      "erc20": "0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     }
    },
    {
     "key": "USDC",
     "name": "USDC",
     "src": {
      "chain": "ethereum",
      "kind": "collateral",
      "router": "0x2f136BaA37Eb5711483D295944EeDa01c4142dA0",
      "bridgeRouter": "0x1613e840ef053a3eAcB3278F3982489354CA8199",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 6,
      "erc20": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xe20C0c642c2841EBe1375770Aa8A1b888Ce1688A",
      "bridgeRouter": "0xCDbf8dA81F0a24f25Bcd23c6232704BBfA410bd4",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 18,
      "erc20": "0xea5b7fD59b7ec0F34663835A3a361F469C2D4c5C",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     }
    },
    {
     "key": "WBTC",
     "name": "WBTC",
     "src": {
      "chain": "ethereum",
      "kind": "collateral",
      "router": "0x4AD2D363Bce045A7dF7C9069cb517cC803409beA",
      "bridgeRouter": "0xF2ecB173b63699C49ace3faae80af5ce677af015",
      "lockbox": "",
      "symbol": "WBTC",
      "decimals": 8,
      "erc20": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      "feeBps": 0
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0x111031c25818a09e2cc41f64e218Ad9e02d231C0",
      "bridgeRouter": "0xb436C84a634ccEECc13d29Dc3F933625522c5e6f",
      "lockbox": "",
      "symbol": "WBTC",
      "decimals": 8,
      "erc20": "0x0185c70Cd058D13cAE392b57471A1E7573842A3A",
      "feeBps": 0
     }
    }
   ]
  },
  {
   "from": "infinite",
   "to": "ethereum",
   "tokens": [
    {
     "key": "USDT",
     "name": "USDT",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xaf16100C917a221A786C5B3dC2cB270f9DcfD447",
      "bridgeRouter": "0x8667682B62CacedA9e87B3CAA21D5B09D9Ae13c3",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 18,
      "erc20": "0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     },
     "dst": {
      "chain": "ethereum",
      "kind": "collateral",
      "router": "0xA0407f73C16776cA60584cCa9a4B15d96376E188",
      "bridgeRouter": "0x56d962fD360bA872115e77E3316909037bfB7E7E",
      "lockbox": "",
      "symbol": "USDT",
      "decimals": 6,
      "erc20": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "feeBps": 0
     }
    },
    {
     "key": "USDC",
     "name": "USDC",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xe20C0c642c2841EBe1375770Aa8A1b888Ce1688A",
      "bridgeRouter": "0xCDbf8dA81F0a24f25Bcd23c6232704BBfA410bd4",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 18,
      "erc20": "0xea5b7fD59b7ec0F34663835A3a361F469C2D4c5C",
      "feeBps": 0,
      "flatFee": "2000000000000000000"
     },
     "dst": {
      "chain": "ethereum",
      "kind": "collateral",
      "router": "0x2f136BaA37Eb5711483D295944EeDa01c4142dA0",
      "bridgeRouter": "0x1613e840ef053a3eAcB3278F3982489354CA8199",
      "lockbox": "",
      "symbol": "USDC",
      "decimals": 6,
      "erc20": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
     }
    },
    {
     "key": "WBTC",
     "name": "WBTC",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0x111031c25818a09e2cc41f64e218Ad9e02d231C0",
      "bridgeRouter": "0xb436C84a634ccEECc13d29Dc3F933625522c5e6f",
      "lockbox": "",
      "symbol": "WBTC",
      "decimals": 8,
      "erc20": "0x0185c70Cd058D13cAE392b57471A1E7573842A3A",
      "feeBps": 0
     },
     "dst": {
      "chain": "ethereum",
      "kind": "collateral",
      "router": "0x4AD2D363Bce045A7dF7C9069cb517cC803409beA",
      "bridgeRouter": "0xF2ecB173b63699C49ace3faae80af5ce677af015",
      "lockbox": "",
      "symbol": "WBTC",
      "decimals": 8,
      "erc20": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      "feeBps": 0
     }
    }
   ]
  },
  {
   "from": "ql1",
   "to": "infinite",
   "tokens": [
    {
     "key": "QOM",
     "name": "QOM",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x30da1e7c8de5FA75B593002E0b2D2910FFcAdCB6",
      "bridgeRouter": "",
      "lockbox": "0x32b78419711a58E8Cd9945430F696f7db996fD50",
      "symbol": "QOM",
      "decimals": 18,
      "erc20": "0xa26dfBF98Dd1A32FAe56A3D2B2D60A8a41b0bDF0"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xf4440822c681Ce4CB80b5a3A508876eE23b40F1b",
      "bridgeRouter": "0x049a78Fe311cf1C23f09cdd4F12420FfC917C8db",
      "lockbox": "",
      "symbol": "QOM",
      "decimals": 18,
      "erc20": "0x53465CbBBA5b14f5Dc00794330f0f4aFb30EAA1d",
      "feeBps": 0
     }
    },
    {
     "key": "BABY",
     "name": "BABY",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x8ff9452f309159828903d2D6cCa58CCcb2b5Cd16",
      "bridgeRouter": "",
      "lockbox": "0x8a9C80244E00baF719289f9CB10fd335B6BA77e5",
      "symbol": "BABY",
      "decimals": 18,
      "erc20": "0x4667fc0a4B996E0f997313a49DE48036B584EF22"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0x49b525D647068E17892a66e08d197e7Faa036D3E",
      "bridgeRouter": "0x4aba9dBE8a990C19501C1c4C3E677f775006D2e2",
      "lockbox": "",
      "symbol": "BABY",
      "decimals": 18,
      "erc20": "0x77479226C103CC3c142fAff6691BC7F849Ce9C92",
      "feeBps": 0
     }
    },
    {
     "key": "FATHER",
     "name": "FATHER",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x54718De5e064DcD1181b7847591c5864434ED92e",
      "bridgeRouter": "",
      "lockbox": "0x631376D745A56CA4EFD9e565BF4cE0d56A8828FC",
      "symbol": "FATHER",
      "decimals": 18,
      "erc20": "0x2860Ec7C34b29F3D2B43788c9a5F0De051f799BB"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xAe3fB59A4c950447386e7d2cA54ab05c857B817E",
      "bridgeRouter": "0x056c116c09ACb788d038E7dDc167249C26493D6e",
      "lockbox": "",
      "symbol": "FATHER",
      "decimals": 18,
      "erc20": "0x8981F00E92f31A87aF12f980383d2217706258e7",
      "feeBps": 0
     }
    },
    {
     "key": "HAWK",
     "name": "HAWK",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x916fb1a761d0Db8888C3F79d6c614C9FFf73b657",
      "bridgeRouter": "",
      "lockbox": "0x51BB05C603bc7D554D37be76cdE13360C1a84286",
      "symbol": "HAWK",
      "decimals": 18,
      "erc20": "0xbC85F14059d60458b614052b4a84734E463878cc"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xBd0c6E7dA96F71cfD2E6651d697b048bAf5c91Cd",
      "bridgeRouter": "0x0d198200dC673e96217ddeA9560d26Ae0d092074",
      "lockbox": "",
      "symbol": "HAWK",
      "decimals": 18,
      "erc20": "0x4E3E79981A64D5678e2e70Fd7B4b9550C2B41dB2",
      "feeBps": 0
     }
    },
    {
     "key": "KET",
     "name": "KET",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x59d6e50f5b0559A088e3eaAc21E520be18453704",
      "bridgeRouter": "",
      "lockbox": "0x2060fA8977B89E55021B592E11134c26b78eAd21",
      "symbol": "KET",
      "decimals": 18,
      "erc20": "0x034c1fe794ab9D30E27E1cE0D89A4591fC9F1FB4"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xb1b313B3767c73398935E5bCDD7914340E73f3dD",
      "bridgeRouter": "0x3BC94E9F417561Ca37559E07dfC65496fcE94557",
      "lockbox": "",
      "symbol": "KET",
      "decimals": 18,
      "erc20": "0xb749D42E6004dB590b2f04F32B87485402A061E2",
      "feeBps": 0
     }
    },
    {
     "key": "OSAK",
     "name": "OSAK",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0xe3a35d9f4EF7eacD5bb47164Ee8d7bff75C2cF6B",
      "bridgeRouter": "",
      "lockbox": "0x49bA579c2cC70260a008809A8182FbCfABc8b45E",
      "symbol": "OSAK",
      "decimals": 18,
      "erc20": "0x5b6aF20880A583128170d8C1fC319889fF405a5A"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xB477ab5A53d8361b735BD812095325a35Fc29b1B",
      "bridgeRouter": "0xA2093426c03ba6F0f6049532b6f13F1e36566358",
      "lockbox": "",
      "symbol": "OSAK",
      "decimals": 18,
      "erc20": "0x404f3A213fF6C5D654F4E95E6a7ED098B1C3d3B3",
      "feeBps": 0
     }
    },
    {
     "key": "CAW",
     "name": "CAW",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0xD14cF03D3753d80a1f6fb818Aa1c728D5c36B3bf",
      "bridgeRouter": "",
      "lockbox": "0xD3E886c616E17202cCB8a5f2932865F281c4Af86",
      "symbol": "CAW",
      "decimals": 18,
      "erc20": "0xd2140E16aDf37194036865E90BbCA1139b739d0D"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xA8493DbB1be229Fbbc9127d6D2e387dbEA2AE214",
      "bridgeRouter": "0x82bA5D61a70677f7f53A9894C63DfB61FD8bCb65",
      "lockbox": "",
      "symbol": "CAW",
      "decimals": 18,
      "erc20": "0xce8aEE7148DaA8943453239C42B7b93f984A49F0",
      "feeBps": 0
     }
    },
    {
     "key": "O",
     "name": "O",
     "src": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x488B1f39AA01196ec8a14891bAfFEe6630155A61",
      "bridgeRouter": "",
      "lockbox": "0xF2ecB173b63699C49ace3faae80af5ce677af015",
      "symbol": "O",
      "decimals": 18,
      "erc20": "0x6c39b68a28bA90F4EB80032ec0eB32ad81cbbEd4"
     },
     "dst": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xE62ba8A1df1ED3628f2C22A245f7A47a76573CB5",
      "bridgeRouter": "0xcB893a7e5f2932531f6e04c0Fc3b17AC4884475f",
      "lockbox": "",
      "symbol": "O",
      "decimals": 18,
      "erc20": "0xF4c14C0322E361f35EB9465c992fB1C21C91C156",
      "feeBps": 0
     }
    }
   ]
  },
  {
   "from": "infinite",
   "to": "ql1",
   "tokens": [
    {
     "key": "QOM",
     "name": "QOM",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xf4440822c681Ce4CB80b5a3A508876eE23b40F1b",
      "bridgeRouter": "0x049a78Fe311cf1C23f09cdd4F12420FfC917C8db",
      "lockbox": "",
      "symbol": "QOM",
      "decimals": 18,
      "erc20": "0x53465CbBBA5b14f5Dc00794330f0f4aFb30EAA1d",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x30da1e7c8de5FA75B593002E0b2D2910FFcAdCB6",
      "bridgeRouter": "",
      "lockbox": "0x32b78419711a58E8Cd9945430F696f7db996fD50",
      "symbol": "QOM",
      "decimals": 18,
      "erc20": "0xa26dfBF98Dd1A32FAe56A3D2B2D60A8a41b0bDF0"
     }
    },
    {
     "key": "BABY",
     "name": "BABY",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0x49b525D647068E17892a66e08d197e7Faa036D3E",
      "bridgeRouter": "0x4aba9dBE8a990C19501C1c4C3E677f775006D2e2",
      "lockbox": "",
      "symbol": "BABY",
      "decimals": 18,
      "erc20": "0x77479226C103CC3c142fAff6691BC7F849Ce9C92",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x8ff9452f309159828903d2D6cCa58CCcb2b5Cd16",
      "bridgeRouter": "",
      "lockbox": "0x8a9C80244E00baF719289f9CB10fd335B6BA77e5",
      "symbol": "BABY",
      "decimals": 18,
      "erc20": "0x4667fc0a4B996E0f997313a49DE48036B584EF22"
     }
    },
    {
     "key": "FATHER",
     "name": "FATHER",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xAe3fB59A4c950447386e7d2cA54ab05c857B817E",
      "bridgeRouter": "0x056c116c09ACb788d038E7dDc167249C26493D6e",
      "lockbox": "",
      "symbol": "FATHER",
      "decimals": 18,
      "erc20": "0x8981F00E92f31A87aF12f980383d2217706258e7",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x54718De5e064DcD1181b7847591c5864434ED92e",
      "bridgeRouter": "",
      "lockbox": "0x631376D745A56CA4EFD9e565BF4cE0d56A8828FC",
      "symbol": "FATHER",
      "decimals": 18,
      "erc20": "0x2860Ec7C34b29F3D2B43788c9a5F0De051f799BB"
     }
    },
    {
     "key": "HAWK",
     "name": "HAWK",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xBd0c6E7dA96F71cfD2E6651d697b048bAf5c91Cd",
      "bridgeRouter": "0x0d198200dC673e96217ddeA9560d26Ae0d092074",
      "lockbox": "",
      "symbol": "HAWK",
      "decimals": 18,
      "erc20": "0x4E3E79981A64D5678e2e70Fd7B4b9550C2B41dB2",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x916fb1a761d0Db8888C3F79d6c614C9FFf73b657",
      "bridgeRouter": "",
      "lockbox": "0x51BB05C603bc7D554D37be76cdE13360C1a84286",
      "symbol": "HAWK",
      "decimals": 18,
      "erc20": "0xbC85F14059d60458b614052b4a84734E463878cc"
     }
    },
    {
     "key": "KET",
     "name": "KET",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xb1b313B3767c73398935E5bCDD7914340E73f3dD",
      "bridgeRouter": "0x3BC94E9F417561Ca37559E07dfC65496fcE94557",
      "lockbox": "",
      "symbol": "KET",
      "decimals": 18,
      "erc20": "0xb749D42E6004dB590b2f04F32B87485402A061E2",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x59d6e50f5b0559A088e3eaAc21E520be18453704",
      "bridgeRouter": "",
      "lockbox": "0x2060fA8977B89E55021B592E11134c26b78eAd21",
      "symbol": "KET",
      "decimals": 18,
      "erc20": "0x034c1fe794ab9D30E27E1cE0D89A4591fC9F1FB4"
     }
    },
    {
     "key": "OSAK",
     "name": "OSAK",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xB477ab5A53d8361b735BD812095325a35Fc29b1B",
      "bridgeRouter": "0xA2093426c03ba6F0f6049532b6f13F1e36566358",
      "lockbox": "",
      "symbol": "OSAK",
      "decimals": 18,
      "erc20": "0x404f3A213fF6C5D654F4E95E6a7ED098B1C3d3B3",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0xe3a35d9f4EF7eacD5bb47164Ee8d7bff75C2cF6B",
      "bridgeRouter": "",
      "lockbox": "0x49bA579c2cC70260a008809A8182FbCfABc8b45E",
      "symbol": "OSAK",
      "decimals": 18,
      "erc20": "0x5b6aF20880A583128170d8C1fC319889fF405a5A"
     }
    },
    {
     "key": "CAW",
     "name": "CAW",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xA8493DbB1be229Fbbc9127d6D2e387dbEA2AE214",
      "bridgeRouter": "0x82bA5D61a70677f7f53A9894C63DfB61FD8bCb65",
      "lockbox": "",
      "symbol": "CAW",
      "decimals": 18,
      "erc20": "0xce8aEE7148DaA8943453239C42B7b93f984A49F0",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0xD14cF03D3753d80a1f6fb818Aa1c728D5c36B3bf",
      "bridgeRouter": "",
      "lockbox": "0xD3E886c616E17202cCB8a5f2932865F281c4Af86",
      "symbol": "CAW",
      "decimals": 18,
      "erc20": "0xd2140E16aDf37194036865E90BbCA1139b739d0D"
     }
    },
    {
     "key": "O",
     "name": "O",
     "src": {
      "chain": "infinite",
      "kind": "xerc20",
      "router": "0xE62ba8A1df1ED3628f2C22A245f7A47a76573CB5",
      "bridgeRouter": "0xcB893a7e5f2932531f6e04c0Fc3b17AC4884475f",
      "lockbox": "",
      "symbol": "O",
      "decimals": 18,
      "erc20": "0xF4c14C0322E361f35EB9465c992fB1C21C91C156",
      "feeBps": 0
     },
     "dst": {
      "chain": "ql1",
      "kind": "xerc20",
      "router": "0x488B1f39AA01196ec8a14891bAfFEe6630155A61",
      "bridgeRouter": "",
      "lockbox": "0xF2ecB173b63699C49ace3faae80af5ce677af015",
      "symbol": "O",
      "decimals": 18,
      "erc20": "0x6c39b68a28bA90F4EB80032ec0eB32ad81cbbEd4"
     }
    }
   ]
  }
 ]
};
