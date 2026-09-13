import { Router } from "express";
import { getAdminStats, getAllUsers, toggleUserStatus } from "../controllers/admin.controller";
import { protect, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

// শুধুমাত্র ADMIN রোলের এক্সেস থাকবে
router.use(protect, authorizeRoles("ADMIN", "admin"));

router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.patch("/users/:id", toggleUserStatus);

export default router;