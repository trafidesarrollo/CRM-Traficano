import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import clientsRouter from "./clients.js";
import contactsRouter from "./contacts.js";
import salespeopleRouter from "./salespeople.js";
import productsRouter from "./products.js";
import emailsRouter from "./emails.js";
import gmailRouter from "./gmail.js";
import opportunitiesRouter from "./opportunities.js";
import activitiesRouter from "./activities.js";
import dashboardRouter from "./dashboard.js";
import promptsRouter from "./prompts.js";
import importsRouter from "./imports.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(clientsRouter);
router.use(contactsRouter);
router.use(salespeopleRouter);
router.use(productsRouter);
router.use(emailsRouter);
router.use(gmailRouter);
router.use(opportunitiesRouter);
router.use(activitiesRouter);
router.use(dashboardRouter);
router.use(promptsRouter);
router.use(importsRouter);

export default router;
