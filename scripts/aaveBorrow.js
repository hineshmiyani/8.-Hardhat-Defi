const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("./getWeth");

async function main() {
  // the protocol treats everything as an ERC20 token
  await getWeth();
  const { deployer } = await getNamedAccounts();
  // we need abi, address

  // Lending Pool Address Provider : 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  // Lending Pool Address get from 👆👆

  const lendingPool = await getLendingPool(deployer);
  console.log(`Lending Pool Address ${lendingPool?.address}`);

  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  // Approve
  await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
  console.log("Depositing...");

  // Deposit
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log("Deposited...");

  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
    lendingPool,
    deployer
  );

  // availableBorrowsETH ??
  // what the consversion rate of DAI is?
  const daiPrice = await getDaiPrice();
  const amountDaiToBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / daiPrice);
  const amountDaiToBorrowInWei = ethers.utils.parseEther(
    amountDaiToBorrow.toString()
  );

  // Borrow DAI Asset:
  // How much we have borrowed?, How much we have in collateral?, How much we can borrow?
  const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  await borrowDai(
    daiTokenAddress,
    lendingPool,
    amountDaiToBorrowInWei,
    deployer
  );
  await getBorrowUserData(lendingPool, deployer);

  // Repay
  await repay(amountDaiToBorrowInWei, daiTokenAddress, lendingPool, deployer);
  await getBorrowUserData(lendingPool, deployer);
}

async function repay(amount, daiAddress, lendingPool, account) {
  // Approve before repay
  await approveERC20(daiAddress, lendingPool.address, amount, account);

  // repay
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
  await repayTx.wait(1);
  console.log("Repaid!");
}

// Borrow
async function borrowDai(
  daiAddress,
  lendingPool,
  amountDaiToBorrowInWei,
  account
) {
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrowInWei,
    1,
    0,
    account
  );
  await borrowTx.wait(1);
  console.log("You have Borrowed DAI.");
}

// Get DAI price using chainlink Oracle
async function getDaiPrice() {
  const daiETHPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x773616E4d11A78F511299002da57A0a94577F1f4"
  );
  const price = (await daiETHPriceFeed.latestRoundData())[1];
  console.log(`DAI Price in ETH is ${price}`);
  return price;
}

// Borrow User Data
async function getBorrowUserData(landingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await landingPool.getUserAccountData(account);

  console.log(`You have ${totalCollateralETH} worth of ETH deposited.`);
  console.log(`You have ${totalDebtETH} worth of ETH borrowed.`);
  console.log(`You can borrow  ${availableBorrowsETH} worth of ETH.`);
  return { availableBorrowsETH, totalDebtETH };
}

// Gey Lending Pool Contract
async function getLendingPool(account) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  );

  const lendingPoolAddress =
    await lendingPoolAddressesProvider?.getLendingPool();

  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  );

  return lendingPool;
}

// Approve ERC20
async function approveERC20(
  erc20Address,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    erc20Address,
    account
  );

  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log("Approved!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
