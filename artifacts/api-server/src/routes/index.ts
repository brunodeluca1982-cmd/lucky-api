import { Router, type IRouter } from "express";
import healthRouter from "./health";
import friendItineraryRouter from "./friend-itinerary";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(friendItineraryRouter);
router.use("/stripe", stripeRouter);

export default router;
