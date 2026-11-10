const accountModel = require("../models/account.model");


async function createAccountController(req, res) {

    const user = req.user;

    const account = await accountModel.create({
        user: user._id
    })

    res.status(201).json({
        account
    })

}

async function getUserAccountsController(req, res) {

    const accounts = await accountModel.find({ user: req.user._id });

    res.status(200).json({
        accounts
    })
}

async function getAccountBalanceController(req, res) {
    const { accountId } = req.params;

    if (typeof accountId !== "string" || !/^[0-9a-fA-F]{24}$/.test(accountId.trim())) {
        return res.status(400).json({
            message: "Invalid account identifier format"
        })
    }

    const account = await accountModel.findOne({
        _id: accountId.trim(),
        user: req.user._id
    })

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        })
    }

    // balance is returned as exact integer paise (1 INR = 100 paise).
    // Frontend must divide by 100 before displaying as major currency units.
    const balance = await account.getBalance();

    res.status(200).json({
        accountId: account._id,
        balance: balance,
        currency: account.currency,
        unit: "PAISE"
    })
}


module.exports = {
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController
}