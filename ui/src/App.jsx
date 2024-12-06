import { useState, useEffect } from "react";
import * as React from "react";
import { Contract, BrowserProvider, ethers } from "ethers";

import {
  CertAddr,
  MyGovernorAddr,
  TimeLockAddr,
  GovTokenAddr,
} from "./contract-data/deployedAddresses.json";
import { abi as Govabi } from "./contract-data/MyGovernor.json";
import { abi as Certabi } from "./contract-data/Cert.json";
import { abi as TimeLockabi } from "./contract-data/TimeLock.json";
import { abi as TokenAbi } from "./contract-data/GovToken.json";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import AddIcon from '@mui/icons-material/Add';
import Chip from '@mui/material/Chip';

function App() {
  const [loginState, setLoginState] = useState("Connect");
  const [proposals, setProposals] = useState([]);
  const [pDescription, setPDescription] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [mintAmount, setMintAmount] = useState("");
  const [openMintDialog, setOpenMintDialog] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [open, setOpen] = React.useState(false);
  const [account, setAccount] = useState(null);
  const [voteType, setVoteType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [votingPower, setVotingPower] = useState("0");
  const [blockInfo, setBlockInfo] = useState({ current: 0, start: 0, end: 0 });
  const [proposalParams, setProposalParams] = useState({
    id: "",
    name: "",
    course: "",
    grade: "",
    date: "",
  });
  const [certificates, setCertificates] = useState([]);
  const [openCertificatesDialog, setOpenCertificatesDialog] = useState(false);
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [roleAddress, setRoleAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [userRoles, setUserRoles] = useState([]);

  // Constants for proposal states
  const ProposalState = {
    Pending: 0,
    Active: 1,
    Canceled: 2,
    Defeated: 3,
    Succeeded: 4,
    Queued: 5,
    Expired: 6,
    Executed: 7,
  };

  const getProposalStateString = (state) => {
    const states = {
      0: "Pending",
      1: "Active",
      2: "Canceled",
      3: "Defeated",
      4: "Succeeded",
      5: "Queued",
      6: "Expired",
      7: "Executed",
    };
    return states[state] || "Unknown";
  };

  // State for proposal form
  const handleProposalParamChange = (param) => (event) => {
    setProposalParams({
      ...proposalParams,
      [param]: event.target.value,
    });
  };

  // Hardhat network configuration
  const networkConfig = {
    chainId: "0x7A69", // 31337 in hex
    chainName: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"],
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  };

  // Check and switch network
  const checkAndSwitchNetwork = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask!");
      }

      // Try to switch to Hardhat network
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: networkConfig.chainId }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [networkConfig],
            });
          } catch (addError) {
            throw new Error("Failed to add Hardhat network to MetaMask");
          }
        } else {
          throw switchError;
        }
      }

      return true;
    } catch (error) {
      console.error("Network switch error:", error);
      alert(error.message);
      return false;
    }
  };

  // Listen for account changes
  React.useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          connectMetaMask(); // Reconnect with new account
        } else {
          setLoginState("Connect");
          setAccount(null);
          setIsAdmin(false);
        }
      });
    }
  }, []);

  async function connectMetaMask() {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      // First verify if the contracts are deployed
      const contractsVerified = await verifyContracts();
      if (!contractsVerified) {
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found!");
      }

      const address = accounts[0];
      setAccount(address);
      setLoginState(address.slice(0, 6) + "..." + address.slice(-4));

      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      try {
        // Create token contract instance
        const tokenContract = new ethers.Contract(
          GovTokenAddr,
          TokenAbi,
          signer
        );

        console.log("Checking contract connection...");
        // First verify if we can connect to the contract
        const tokenName = await tokenContract.name();
        console.log("Token name:", tokenName);

        // Check if user is admin
        console.log("Checking owner...");
        const owner = await tokenContract.owner();
        console.log("Contract owner:", owner);
        console.log("Current address:", address);

        const isUserAdmin = owner.toLowerCase() === address.toLowerCase();
        setIsAdmin(isUserAdmin);
        console.log("Is admin:", isUserAdmin);

        // Get token balance
        const balance = await tokenContract.balanceOf(address);
        setTokenBalance(ethers.formatUnits(balance, 18));
        console.log("Token balance:", ethers.formatUnits(balance, 18));

        if (isUserAdmin) {
          alert("Welcome Admin! You can now mint tokens.");
        }
      } catch (contractError) {
        console.error("Contract interaction error:", contractError);
        alert("Error interacting with contracts. Please ensure you are connected to the correct network (Hardhat local network).");
        return;
      }
    } catch (error) {
      console.error("Connection Error:", error);
      alert("Error connecting: " + error.message);
      setLoginState("Connect");
      setAccount(null);
      setIsAdmin(false);
    }
  }

  // Function to check if contracts are deployed
  const verifyContracts = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Check each contract
      const contracts = [
        { name: 'GovToken', address: GovTokenAddr },
        { name: 'TimeLock', address: TimeLockAddr },
        { name: 'Cert', address: CertAddr },
        { name: 'MyGovernor', address: MyGovernorAddr }
      ];

      for (const contract of contracts) {
        const code = await provider.getCode(contract.address);
        if (code === '0x') {
          alert(`${contract.name} contract is not deployed at ${contract.address}. Please ensure Hardhat node is running and deploy contracts first.`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Contract verification error:", error);
      alert("Error verifying contracts: " + error.message);
      return false;
    }
  };

  // Add network change listener
  React.useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("chainChanged", (chainId) => {
        // Handle network change
        window.location.reload();
      });
    }
  }, []);

  // Add account change listener
  React.useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          connectMetaMask(); // Reconnect with new account
        } else {
          setLoginState("Connect");
          setAccount(null);
          setIsAdmin(false);
        }
      });
    }
  }, []);

  const handleMintOpen = () => {
    if (!isAdmin) {
      alert("Only admin can mint tokens!");
      return;
    }
    setOpenMintDialog(true);
  };

  const handleMint = async () => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }

    if (!mintAmount || isNaN(mintAmount) || parseFloat(mintAmount) <= 0) {
      alert("Please enter a valid amount to mint!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(
        GovTokenAddr,
        TokenAbi,
        signer
      );

      // Check if the connected account is the owner
      const owner = await tokenContract.owner();
      if (owner.toLowerCase() !== account.toLowerCase()) {
        alert("Only the contract owner can mint tokens!");
        return;
      }

      // Convert the amount to wei (18 decimals)
      const amount = ethers.parseUnits(mintAmount.toString(), 18);
      console.log("Minting", ethers.formatUnits(amount, 18), "tokens to", account);

      // Get the nonce for the transaction
      const nonce = await provider.getTransactionCount(account);

      // Get the current fee data
      const feeData = await provider.getFeeData();

      // Prepare the transaction
      const tx = await tokenContract.mint.populateTransaction(account, amount);
      
      // Estimate gas with the populated transaction
      const estimatedGas = await provider.estimateGas({
        from: account,
        to: GovTokenAddr,
        data: tx.data,
        value: 0
      });

      // Calculate gas limit with 20% buffer (converting to BigInt)
      const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.2));

      // Send the transaction with explicit parameters
      const transaction = await tokenContract.mint(account, amount, {
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        nonce: nonce
      });

      console.log("Mint transaction submitted:", transaction.hash);
      alert("Minting in progress... Please wait for confirmation.");

      // Wait for the transaction
      const receipt = await transaction.wait();
      console.log("Mint transaction confirmed:", receipt);

      // Update token balance
      const newBalance = await tokenContract.balanceOf(account);
      setTokenBalance(ethers.formatUnits(newBalance, 18));

      alert("Tokens minted successfully!");
      setOpenMintDialog(false);
      setMintAmount("");
    } catch (error) {
      console.error("Minting Error:", error);
      
      // More user-friendly error message
      let errorMessage = "Error minting tokens. ";
      if (error.message.includes("insufficient funds")) {
        errorMessage += "Insufficient funds for gas.";
      } else if (error.message.includes("user rejected")) {
        errorMessage += "Transaction was rejected.";
      } else if (error.message.includes("execution reverted")) {
        errorMessage += "Transaction reverted. Make sure you are the contract owner.";
      } else if (error.message.includes("nonce too low")) {
        errorMessage += "Transaction nonce issue. Please try again.";
      } else if (error.message.includes("BigInt")) {
        errorMessage += "Number conversion error. Please try a smaller amount.";
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  };

  const delegateTokens = async () => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const tokenContract = new Contract(GovTokenAddr, TokenAbi, signer);

      // Check if user has any tokens using string comparison
      const balance = await tokenContract.balanceOf(account);
      const balanceString = balance.toString();
      
      if (balanceString === "0") {
        alert("You don't have any tokens to delegate!");
        return;
      }

      // Delegate tokens to self
      const tx = await tokenContract.delegate(account);
      alert("Delegating tokens... Please wait.");
      await tx.wait();
      
      // Update voting power
      await updateVotingPower(tokenContract, account);
      
      alert("Tokens delegated successfully! You can now create proposals and vote.");
    } catch (error) {
      console.error("Delegation error:", error);
      alert("Error delegating tokens: " + error.message);
    }
  };

  const updateVotingPower = async (tokenContract, userAddress) => {
    try {
      const votes = await tokenContract.getVotes(userAddress);
      // Convert BigInt to string before formatting
      const votesString = votes.toString();
      const formatted = ethers.formatUnits(votesString, 18);
      setVotingPower(formatted);
    } catch (error) {
      console.error("Error updating voting power:", error);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const Govinstance = new Contract(MyGovernorAddr, Govabi, signer);
      const Certinstance = new Contract(CertAddr, Certabi, signer);

      // Check if user has enough voting power
      const tokenContract = new Contract(GovTokenAddr, TokenAbi, signer);
      const votes = await tokenContract.getVotes(account);

      if (votes.toString() === "0") {
        alert(
          "You need voting power to create a proposal. Please get some tokens first and delegate them."
        );
        return;
      }

      // Validate parameters
      if (
        !proposalParams.id ||
        !proposalParams.name ||
        !proposalParams.course ||
        !proposalParams.grade ||
        !proposalParams.date
      ) {
        alert("Please fill in all fields");
        return;
      }

      // Convert ID to number
      const id = parseInt(proposalParams.id);
      if (isNaN(id)) {
        alert("ID must be a valid number");
        return;
      }

      // Encode the function call
      const transferCalldata = Certinstance.interface.encodeFunctionData("issue", [
        id,
        proposalParams.name,
        proposalParams.course,
        proposalParams.grade,
        proposalParams.date
      ]);

      // Get the current fee data
      const feeData = await provider.getFeeData();

      // Get the nonce
      const nonce = await provider.getTransactionCount(account);

      // Prepare the proposal transaction
      const proposalTx = await Govinstance.propose.populateTransaction(
        [CertAddr],           // target addresses
        [0],                  // values (no ETH being sent)
        [transferCalldata],   // encoded function calls
        "New Certificate issue"  // description
      );

      // Estimate gas
      const estimatedGas = await provider.estimateGas({
        from: account,
        to: MyGovernorAddr,
        data: proposalTx.data,
        value: 0
      });

      // Calculate gas limit with 20% buffer
      const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.2));

      // Show pending message
      alert("Creating proposal... Please wait and approve the transaction.");

      // Send the proposal with explicit parameters
      const tx = await Govinstance.propose(
        [CertAddr],
        [0],
        [transferCalldata],
        "New Certificate issue",
        {
          gasLimit,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          nonce
        }
      );

      console.log("Proposal transaction submitted:", tx.hash);

      // Wait for transaction
      const receipt = await tx.wait();
      console.log("Proposal transaction confirmed:", receipt);

      alert("Proposal created successfully! Transaction hash: " + tx.hash);
      
      // Clear form
      setProposalParams({
        id: "",
        name: "",
        course: "",
        grade: "",
        date: ""
      });
      
    } catch (error) {
      console.error("Error creating proposal:", error);
      
      let errorMessage = "Error creating proposal: ";
      if (error.message.includes("insufficient funds")) {
        errorMessage += "Insufficient funds for gas.";
      } else if (error.message.includes("user rejected")) {
        errorMessage += "Transaction was rejected.";
      } else if (error.message.includes("execution reverted")) {
        errorMessage += "Transaction reverted. Make sure you have enough voting power.";
      } else if (error.message.includes("nonce too low")) {
        errorMessage += "Transaction nonce issue. Please try again.";
      } else if (error.message.includes("BigInt")) {
        errorMessage += "Number conversion error. Please try again.";
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  };

  const castVote = async (proposalId, voteType) => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const Govinstance = new Contract(MyGovernorAddr, Govabi, signer);

      // Check if user has voting power
      const tokenContract = new Contract(GovTokenAddr, TokenAbi, signer);
      const votes = await tokenContract.getVotes(account);

      if (votes.toString() === "0") {
        alert("You need voting power to vote. Please delegate your tokens first using the 'Delegate' button.");
        return;
      }

      // Check proposal state
      const state = await Govinstance.state(proposalId);
      if (state.toString() !== "1") { // 1 is Active state
        alert(`Cannot vote on this proposal. Current state: ${getProposalStateString(Number(state))}`);
        return;
      }

      // Check if user has already voted
      const hasVoted = await Govinstance.hasVoted(proposalId, account);
      if (hasVoted) {
        alert("You have already voted on this proposal");
        return;
      }

      // Use the numeric vote type directly
      const voteValue = Number(voteType);

      // Show pending message
      alert("Casting vote... Please wait and approve the transaction.");

      // Cast the vote with explicit gas estimation
      const gasEstimate = await Govinstance.castVote.estimateGas(proposalId, voteValue);
      const gasLimit = BigInt(Math.floor(Number(gasEstimate) * 1.2)); // Add 20% buffer

      const voteTx = await Govinstance.castVote(proposalId, voteValue, {
        gasLimit: gasLimit
      });
      
      console.log("Vote transaction submitted:", voteTx.hash);
      await voteTx.wait();

      alert("Vote cast successfully!");
      getEvents(); // Refresh the proposals list
    } catch (error) {
      console.error("Error casting vote:", error);
      let errorMessage = "Error casting vote: ";
      
      if (error.message.includes("GovernorVotingSimple: vote already cast")) {
        errorMessage = "You have already voted on this proposal";
      } else if (error.message.includes("Governor: vote not currently active")) {
        errorMessage = "This proposal is not currently active for voting";
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  };

  const getEvents = async () => {
    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const Govinstance = new Contract(MyGovernorAddr, Govabi, signer);

      const filter = Govinstance.filters.ProposalCreated();
      const events = await Govinstance.queryFilter(filter);
      console.log("ProposalCreated events:", events);

      // Get states for all proposals
      const proposalStatesPromises = events.map(async (event) => {
        const proposalId = event.args[0].toString();
        const description = event.args[8];
        const state = await Govinstance.state(proposalId);
        console.log(`Proposal ${proposalId} state:`, state.toString()); // Debug log
        return [proposalId, description, state.toString()];
      });

      const proposalsWithStates = await Promise.all(proposalStatesPromises);
      console.log("All proposals with states:", proposalsWithStates); // Debug log
      setProposals(proposalsWithStates);
    } catch (error) {
      console.error("Error fetching events:", error);
      alert("Error fetching proposals: " + error.message);
    }
  };

  const getProposalState = async (proposalId) => {
    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const Govinstance = new Contract(MyGovernorAddr, Govabi, signer);
      const state = await Govinstance.state(proposalId);
      return state;
    } catch (error) {
      console.error("Error getting proposal state:", error);
      return null;
    }
  };

  const checkProposalState = async (proposalId) => {
    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const Govinstance = new Contract(MyGovernorAddr, Govabi, signer);

      // Get the current block number
      const provider = new ethers.BrowserProvider(window.ethereum);
      const currentBlock = await provider.getBlockNumber();

      // Get the proposal details
      const snapshot = await Govinstance.proposalSnapshot(proposalId);
      const deadline = await Govinstance.proposalDeadline(proposalId);
      const state = await Govinstance.state(proposalId);

      console.log("Current Block:", currentBlock);
      console.log("Proposal Snapshot:", snapshot.toString());
      console.log("Proposal Deadline:", deadline.toString());
      console.log("Proposal State:", getProposalStateString(state));

      let message = `Proposal Status:\n`;
      message += `Current Block: ${currentBlock}\n`;
      message += `Voting Starts: ${snapshot.toString()}\n`;
      message += `Voting Ends: ${deadline.toString()}\n`;
      message += `Current State: ${getProposalStateString(state)}`;

      if (state === ProposalState.Pending) {
        message += `\n\nWaiting for block ${snapshot.toString()} to start voting.`;
      }

      alert(message);
    } catch (error) {
      console.error("Error checking proposal state:", error);
      alert("Error checking proposal state: " + error.message);
    }
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handlePDesChange = (event) => {
    setPDescription(event.target.value);
  };

  const refreshProposals = async () => {
    setIsLoading(true);
    try {
      await getEvents();
    } finally {
      setIsLoading(false);
    }
  };

  // Load proposals when component mounts or account changes
  React.useEffect(() => {
    if (account) {
      getEvents();
    }
  }, [account]);

  const checkVotingPower = async () => {
    if (!account) return;

    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const tokenContract = new Contract(GovTokenAddr, TokenAbi, signer);
      const votes = await tokenContract.getVotes(account);
      // Convert BigInt to string before formatting
      const votesString = votes.toString();
      const formatted = ethers.formatUnits(votesString, 18);
      setVotingPower(formatted);
    } catch (error) {
      console.error("Error checking voting power:", error);
    }
  };

  // Auto-refresh proposals and check voting power
  React.useEffect(() => {
    let intervalId;

    const refreshData = async () => {
      if (!autoRefresh) return;

      try {
        await getEvents();
        await checkVotingPower();

        // Get current block
        const provider = new ethers.BrowserProvider(window.ethereum);
        const currentBlock = await provider.getBlockNumber();
        setBlockInfo((prev) => ({ ...prev, current: currentBlock }));
      } catch (error) {
        console.error("Auto-refresh error:", error);
      }
    };

    if (autoRefresh) {
      refreshData();
      intervalId = setInterval(refreshData, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, account]);

  const getProposalTiming = async (proposalId) => {
    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const Govinstance = new Contract(MyGovernorAddr, Govabi, signer);

      const snapshot = await Govinstance.proposalSnapshot(proposalId);
      const deadline = await Govinstance.proposalDeadline(proposalId);

      setBlockInfo((prev) => ({
        ...prev,
        start: Number(snapshot),
        end: Number(deadline),
      }));

      return { snapshot, deadline };
    } catch (error) {
      console.error("Error getting proposal timing:", error);
      return null;
    }
  };

  const getBlockProgress = () => {
    if (!blockInfo.start || !blockInfo.end) return 0;
    const total = blockInfo.end - blockInfo.start;
    const current = blockInfo.current - blockInfo.start;
    return Math.max(0, Math.min(100, (current / total) * 100));
  };

  // Role Management Functions
  const PROPOSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROPOSER_ROLE"));
  const VOTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VOTER_ROLE"));

  const grantRole = async () => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new Contract(GovTokenAddr, TokenAbi, signer);

      // Verify the address is valid
      if (!ethers.isAddress(targetAddress)) {
        alert("Please enter a valid Ethereum address!");
        return;
      }

      // For both roles, we'll mint tokens which gives voting power
      try {
        // Mint tokens to the address (this gives them voting power)
        const mintAmount = ethers.parseUnits("1", 18); // 1 token
        const mintTx = await tokenContract.mint(targetAddress, mintAmount);
        await mintTx.wait();
        console.log("Minted tokens to:", targetAddress);

        // Auto-delegate tokens to the address
        const delegateTx = await tokenContract.delegate(targetAddress);
        await delegateTx.wait();
        console.log("Delegated tokens to:", targetAddress);

        alert(`Successfully granted ${selectedRole} role to ${targetAddress}`);
        
        // Clear form
        setSelectedRole('');
        setTargetAddress('');
        
      } catch (error) {
        console.error("Transaction error:", error);
        alert("Error in transaction: " + error.message);
      }
      
    } catch (error) {
      console.error("Error granting role:", error);
      alert("Error granting role: " + error.message);
    }
  };

  // Simplified role checking function
  const checkUserRoles = async (address) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tokenContract = new Contract(GovTokenAddr, TokenAbi, provider);
      
      const roles = [];
      
      // Check token balance
      const balance = await tokenContract.balanceOf(address);
      const votes = await tokenContract.getVotes(address);
      
      if (balance > 0) roles.push('Proposer');
      if (votes > 0) roles.push('Voter');
      
      setUserRoles(roles);
      return roles;
      
    } catch (error) {
      console.error("Error checking roles:", error);
      return [];
    }
  };

  // Delegation Function
  const handleDelegation = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      // Check network first
      const networkOk = await checkAndSwitchNetwork();
      if (!networkOk) {
        alert("Please connect to the Hardhat network");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(
        GovTokenAddr,
        TokenAbi,
        signer
      );

      // Check if user has any tokens before attempting delegation
      const balance = await tokenContract.balanceOf(account);
      if (balance <= 0) {
        alert("You need to have tokens before you can delegate");
        return;
      }

      // Prepare the transaction
      const delegatee = account; // Self-delegation
      
      // Get gas estimate
      const gasEstimate = await tokenContract.delegate.estimateGas(delegatee).catch(error => {
        console.error("Gas estimation failed:", error);
        return BigInt(100000); // fallback gas limit as BigInt
      });

      // Calculate gas limit with buffer (using BigInt operations)
      const gasBuffer = (gasEstimate * BigInt(120)) / BigInt(100); // 20% buffer
      
      // Send the transaction with explicit gas limit
      const tx = await tokenContract.delegate(delegatee, {
        gasLimit: gasBuffer // BigInt value
      });

      alert("Delegation transaction submitted. Please wait for confirmation...");
      
      await tx.wait();
      alert("Delegation successful!");
      
      // Update voting power after successful delegation
      await updateVotingPower(tokenContract, account);
      
    } catch (error) {
      console.error("Error delegating tokens:", error);
      if (error.code === 4001) {
        alert("Transaction was rejected. Please try again.");
      } else if (error.code === -32603) {
        alert("Transaction failed. Please make sure you have enough ETH for gas and try again.");
      } else {
        alert("Error delegating tokens: " + error.message);
      }
    }
  };

  // Queue Proposal Function
  const queueProposal = async (proposalId) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const governorContract = new ethers.Contract(
        MyGovernorAddr,
        Govabi,
        signer
      );

      const tx = await governorContract.queue(proposalId);
      await tx.wait();
      alert("Proposal queued successfully!");
      getEvents();
    } catch (error) {
      console.error("Error queueing proposal:", error);
      alert("Error queueing proposal: " + error.message);
    }
  };

  // Execute Proposal Function
  const executeProposal = async (proposalId) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const governorContract = new ethers.Contract(
        MyGovernorAddr,
        Govabi,
        signer
      );

      const tx = await governorContract.execute(proposalId);
      await tx.wait();
      alert("Proposal executed successfully!");
      getEvents();
    } catch (error) {
      console.error("Error executing proposal:", error);
      alert("Error executing proposal: " + error.message);
    }
  };

  // View Certificates Function
  const viewCertificates = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const certContract = new ethers.Contract(
        CertAddr,
        Certabi,
        provider
      );

      const certificates = await certContract.getAllCertificates();
      setCertificates(certificates);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      alert("Error fetching certificates: " + error.message);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f7fa', minHeight: '100vh' }}>
      <AppBar position="static" sx={{ 
        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
        boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
      }}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            DAO Governance Platform
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isAdmin && (
              <Typography variant="body2" sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.1)', 
                px: 2, 
                py: 0.5, 
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center'
              }}>
                Admin Access
              </Typography>
            )}
            <Button
              color="inherit"
              onClick={connectMetaMask}
              sx={{
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                px: 3,
                py: 1,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.8)'
                }
              }}
            >
              <b>{loginState}</b>
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Dashboard Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)'
            }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Token Balance</Typography>
                <Typography variant="h4">{tokenBalance}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)'
            }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Voting Power</Typography>
                <Typography variant="h4">{votingPower}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)'
            }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Active Proposals</Typography>
                <Typography variant="h4">{proposals.filter(p => p[2] === "1").length}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ 
          p: 3, 
          borderRadius: 2, 
          bgcolor: 'white', 
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          mb: 4
        }}>
          <Box sx={{
            display: "flex",
            gap: 2,
            mb: 3,
            alignItems: "center",
            flexWrap: "wrap",
          }}>
            <Button 
              variant="contained" 
              onClick={handleClickOpen}
              sx={{
                borderRadius: '20px',
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              }}
              startIcon={<AddIcon />}
            >
              New Proposal
            </Button>
            {isAdmin && (
              <>
                <Button 
                  variant="contained" 
                  onClick={() => setOpenRoleDialog(true)}
                  sx={{
                    borderRadius: '20px',
                    background: 'linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)',
                    boxShadow: '0 3px 5px 2px rgba(255, 152, 0, .3)',
                  }}
                >
                  Grant Roles
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => setOpenMintDialog(true)}
                  sx={{
                    borderRadius: '20px',
                    background: 'linear-gradient(45deg, #4CAF50 30%, #81C784 90%)',
                    boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
                  }}
                >
                  Mint Tokens
                </Button>
              </>
            )}
            <Button 
              variant="outlined" 
              onClick={() => handleDelegation(account)}
              sx={{
                borderRadius: '20px',
                borderColor: '#2196F3',
                color: '#2196F3',
                '&:hover': {
                  borderColor: '#1976D2',
                  bgcolor: 'rgba(33, 150, 243, 0.1)',
                }
              }}
            >
              Delegate Tokens
            </Button>
            <Button 
              variant="outlined"
              onClick={() => setOpenCertificatesDialog(true)}
              sx={{
                borderRadius: '20px',
                borderColor: '#9C27B0',
                color: '#9C27B0',
                '&:hover': {
                  borderColor: '#7B1FA2',
                  bgcolor: 'rgba(156, 39, 176, 0.1)',
                }
              }}
            >
              View Certificates
            </Button>
          </Box>
        </Box>

        {/* Proposals Section */}
        <Box sx={{ 
          p: 3, 
          borderRadius: 2, 
          bgcolor: 'white', 
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
        }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            Proposals
          </Typography>
          {proposals.length === 0 ? (
            <Typography color="text.secondary">No proposals found</Typography>
          ) : (
            <Grid container spacing={3}>
              {proposals.map((proposal, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card sx={{ 
                    height: "100%",
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.15)'
                    }
                  }}>
                    <CardContent>
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6">
                          Proposal #{index + 1}
                        </Typography>
                        <Chip
                          label={getProposalStateString(Number(proposal[2]))}
                          color={proposal[2] === "1" ? "success" : 
                                 proposal[2] === "4" ? "primary" :
                                 proposal[2] === "3" ? "error" : "default"}
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {proposal[1]}
                      </Typography>

                      {proposal[2] === "1" ? (
                        <Box sx={{ mt: 2 }}>
                          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                            <InputLabel>Vote</InputLabel>
                            <Select
                              value={voteType}
                              onChange={(e) => setVoteType(e.target.value)}
                              label="Vote"
                            >
                              <MenuItem value={1}>For</MenuItem>
                              <MenuItem value={0}>Against</MenuItem>
                              <MenuItem value={2}>Abstain</MenuItem>
                            </Select>
                          </FormControl>
                          
                          <Button
                            variant="contained"
                            onClick={() => castVote(proposal[0], voteType)}
                            fullWidth
                            disabled={voteType === ""}
                            sx={{
                              mt: 1,
                              borderRadius: '20px',
                              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                            }}
                          >
                            Cast Vote
                          </Button>
                        </Box>
                      ) : (
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ mt: 2, fontStyle: 'italic' }}
                        >
                          {proposal[2] === "0" ? 
                            "Voting has not started yet" :
                            proposal[2] === "4" ?
                            "Proposal succeeded" :
                            proposal[2] === "3" ?
                            "Proposal defeated" :
                            proposal[2] === "5" ?
                            "Proposal queued" :
                            proposal[2] === "7" ?
                            "Proposal executed" :
                            `Voting is closed - Status: ${getProposalStateString(Number(proposal[2]))}`}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Container>
      <React.Fragment>
        <Dialog 
          open={open} 
          onClose={handleClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
            }
          }}
        >
          <DialogTitle sx={{ 
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            color: 'white'
          }}>
            Create New Proposal
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <DialogContentText sx={{ mb: 2 }}>
              Enter the details for the new certificate proposal
            </DialogContentText>
            <TextField
              margin="dense"
              label="Certificate ID"
              type="number"
              fullWidth
              value={proposalParams.id}
              onChange={handleProposalParamChange("id")}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              margin="dense"
              label="Name"
              type="text"
              fullWidth
              value={proposalParams.name}
              onChange={handleProposalParamChange("name")}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              margin="dense"
              label="Course"
              type="text"
              fullWidth
              value={proposalParams.course}
              onChange={handleProposalParamChange("course")}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              margin="dense"
              label="Grade"
              type="text"
              fullWidth
              value={proposalParams.grade}
              onChange={handleProposalParamChange("grade")}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              margin="dense"
              label="Date"
              type="text"
              fullWidth
              value={proposalParams.date}
              onChange={handleProposalParamChange("date")}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              margin="dense"
              label="Proposal Description"
              type="text"
              fullWidth
              multiline
              rows={4}
              value={pDescription}
              onChange={handlePDesChange}
              sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <Button 
              onClick={handleClose}
              sx={{
                borderRadius: '20px',
                px: 3,
                color: '#666'
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              variant="contained"
              sx={{
                borderRadius: '20px',
                px: 3,
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              }}
            >
              Submit
            </Button>
          </DialogActions>
        </Dialog>
      </React.Fragment>
      {/* Mint Dialog */}
      <Dialog 
        open={openMintDialog} 
        onClose={() => setOpenMintDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          background: 'linear-gradient(45deg, #4CAF50 30%, #81C784 90%)',
          color: 'white'
        }}>
          Mint Tokens
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <DialogContentText sx={{ mb: 2 }}>
            Enter the amount of tokens to mint:
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Amount"
            type="number"
            fullWidth
            value={mintAmount}
            onChange={(e) => setMintAmount(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Button 
            onClick={() => setOpenMintDialog(false)}
            sx={{
              borderRadius: '20px',
              px: 3,
              color: '#666'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleMint}
            variant="contained"
            sx={{
              borderRadius: '20px',
              px: 3,
              background: 'linear-gradient(45deg, #4CAF50 30%, #81C784 90%)',
              boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
            }}
          >
            Mint
          </Button>
        </DialogActions>
      </Dialog>
      {/* Role Dialog */}
      <Dialog 
        open={openRoleDialog} 
        onClose={() => setOpenRoleDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          background: 'linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)',
          color: 'white'
        }}>
          Grant Role
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            label="Address"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            fullWidth
            margin="normal"
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="proposer">Proposer</MenuItem>
              <MenuItem value="voter">Voter</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Button 
            onClick={() => setOpenRoleDialog(false)}
            sx={{
              borderRadius: '20px',
              px: 3,
              color: '#666'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={grantRole}
            variant="contained"
            sx={{
              borderRadius: '20px',
              px: 3,
              background: 'linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)',
              boxShadow: '0 3px 5px 2px rgba(255, 152, 0, .3)',
            }}
          >
            Grant Role
          </Button>
        </DialogActions>
      </Dialog>
      {/* Certificates Dialog */}
      <Dialog
        open={openCertificatesDialog}
        onClose={() => setOpenCertificatesDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          background: 'linear-gradient(45deg, #9C27B0 30%, #BA68C8 90%)',
          color: 'white'
        }}>
          Issued Certificates
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {certificates.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              No certificates found
            </Typography>
          ) : (
            <List>
              {certificates.map((cert, index) => (
                <ListItem 
                  key={index}
                  sx={{
                    mb: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="h6" sx={{ color: '#9C27B0' }}>
                        Certificate #{index + 1}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography component="div" variant="body2">
                          <strong>Student:</strong> {cert.student}
                        </Typography>
                        <Typography component="div" variant="body2">
                          <strong>Course:</strong> {cert.course}
                        </Typography>
                        <Typography component="div" variant="body2">
                          <strong>Grade:</strong> {cert.grade}
                        </Typography>
                        <Typography component="div" variant="body2">
                          <strong>Date:</strong> {cert.date}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Button 
            onClick={() => setOpenCertificatesDialog(false)}
            variant="contained"
            sx={{
              borderRadius: '20px',
              px: 3,
              background: 'linear-gradient(45deg, #9C27B0 30%, #BA68C8 90%)',
              boxShadow: '0 3px 5px 2px rgba(156, 39, 176, .3)',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;