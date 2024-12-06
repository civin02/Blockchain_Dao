require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      // See its defaults
    },
    // sepolia: {
    //   url: "https://eth-sepolia.g.alchemy.com/v2/lHsk508FvXfDO0wO8DGxkumcQR_L_NhA",
    //   accounts: ["private_key"] //0.01 Eth
    // }
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
};