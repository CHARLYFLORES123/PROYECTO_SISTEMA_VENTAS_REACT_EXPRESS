import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import brandsRouter from "./brands";
import productsRouter from "./products";
import customersRouter from "./customers";
import suppliersRouter from "./suppliers";
import salesRouter from "./sales";
import quotesRouter from "./quotes";
import dashboardRouter from "./dashboard";
import businessSettingsRouter from "./business-settings";
import paymentMethodsRouter from "./payment-methods";
import usersManagementRouter from "./users-management";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/categories", categoriesRouter);
router.use("/brands", brandsRouter);
router.use("/products", productsRouter);
router.use("/customers", customersRouter);
router.use("/suppliers", suppliersRouter);
router.use("/sales", salesRouter);
router.use("/quotes", quotesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/business-settings", businessSettingsRouter);
router.use("/payment-methods", paymentMethodsRouter);
router.use("/users", usersManagementRouter);
router.use("/reports", reportsRouter);

export default router;
