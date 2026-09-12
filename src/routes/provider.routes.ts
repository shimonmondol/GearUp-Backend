import { Router } from "express";
import { Role } from "@prisma/client";
import {
  getMyGears,
  createGear,
  updateGear,
  deleteGear,
} from "../controllers/gear.controller";
import {
  getProviderOrders,
  updateOrder,
} from "../controllers/order.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";

const router = Router();

// গ্লোবালি সব প্রোভাইডার রুটের জন্য Auth এবং Role গার্ড
router.use(protect);
router.use(restrictTo(Role.provider, "provider" as any));

// ==========================================
// 1. Gear Management Routes (/api/provider/gear)
// ==========================================

// প্রোভাইডারের সব গিয়ার ফেচ করা
router.get("/gear", getMyGears);

// নতুন গিয়ার তালিকাভুক্ত করা (POST /api/provider/gear)
router.post("/gear", createGear); // 👈 ২. এই নতুন রুটটি যোগ করা হলো

// গিয়ার স্টক বা যেকোনো ফিল্ড আপডেট (PATCH & PUT উভয়টিই সাপোর্ট করবে)
router.patch("/gear/:id", updateGear);
router.put("/gear/:id", updateGear);

// গিয়ার তালিকা থেকে ডিলিট করা
router.delete("/gear/:id", deleteGear);

// ==========================================
// 2. Order Management Routes (/api/provider/orders)
// ==========================================

router.get("/orders", getProviderOrders);
router.patch("/orders/:id", updateOrder);

export default router;