import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth.routes"; 
import userRouter from "./routes/user.route";
import gearRouter from "./routes/gear.routes";
import categoryRouter from "./routes/category.route";
import orderRouter from "./routes/order.route";
import rentalRoutes from "./routes/rental.routes";
import reviewRouter from "./routes/review.route";
import paymentRouter from "./routes/payment.routes";
import { globalErrorHandler } from "./middlewares/error.middleware";

dotenv.config();

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("GearUp Running Successful");
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/gear", gearRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/orders", orderRouter);
app.use("/api/rentals", rentalRoutes);
app.use("/api/reviews", reviewRouter);
app.use("/api/payments", paymentRouter);
app.use(globalErrorHandler);

const PORT: number | string = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});