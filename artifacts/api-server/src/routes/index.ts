import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import customersRouter from "./customers";
import salesRouter from "./sales";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/customers", customersRouter);
router.use("/sales", salesRouter);
router.use("/dashboard", dashboardRouter);

export default router;
