import { Router } from "express";
import { 
  getAllOrders, 
  createOrder, 
  getMyOrders,
  getProviderOrders,
  updateOrder,
  cancelOrder,
  deleteOrder 
} from "../controllers/order.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";

const router = Router();

// 1. All Orders List (Admin Only)
router.get("/", protect, restrictTo("admin"), getAllOrders); 

// 2. Customer's Own Orders List
router.get("/my-orders", protect, getMyOrders);

// ⚠️ 3. Provider's Incoming Rental Orders (অবশ্যই /:id এর উপরে থাকবে)
router.get("/provider", protect, restrictTo("provider"), getProviderOrders);

// 4. Create New Order
router.post("/", protect, createOrder);

// 5. Update Order Details or Status
router.patch("/:id", protect, updateOrder);

// 6. Cancel Order
router.patch("/:id/cancel", protect, cancelOrder);

// 7. Delete Order Permanently
router.delete("/:id", protect, deleteOrder);

export default router;