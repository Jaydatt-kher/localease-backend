import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import {
    initiatePayment,
    verifyPayment,
    getProviderPayments,
    rechargeWallet,
    verifyRecharge,
    getWalletTransactions,
    initiateWithdrawal,
    downloadReceipt,
    getPublicAdminSettings
} from "../controllers/payment.controller.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";

const paymentRouter = express.Router();

paymentRouter.get("/admin-settings", getPublicAdminSettings);

paymentRouter.post("/initiate", isAuth, authorizeRoles("customer"), paymentLimiter, initiatePayment);
paymentRouter.post("/verify", isAuth, authorizeRoles("customer"), paymentLimiter, verifyPayment);

paymentRouter.get("/provider/payments", isAuth, authorizeRoles("serviceProvider"), getProviderPayments);
paymentRouter.get("/wallet/transactions", isAuth, authorizeRoles("serviceProvider"), getWalletTransactions);
paymentRouter.post("/recharge", isAuth, authorizeRoles("serviceProvider"), paymentLimiter, rechargeWallet);
paymentRouter.post("/verify-recharge", isAuth, authorizeRoles("serviceProvider"), paymentLimiter, verifyRecharge);
paymentRouter.post("/wallet/withdraw", isAuth, authorizeRoles("serviceProvider"), paymentLimiter, initiateWithdrawal);

paymentRouter.get("/:id/receipt", isAuth, downloadReceipt);

export default paymentRouter;
