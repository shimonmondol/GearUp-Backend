import { Request, Response } from "express";
import prisma from "../config/prisma";

// ১. অ্যাডমিন গ্লোবাল স্ট্যাটস
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalGear, totalRentals, revenueData] =
      await Promise.all([
        prisma.user.count(),
        prisma.gearItem.count(),
        prisma.rentalOrder.count(),
        prisma.rentalOrder.aggregate({
          _sum: { totalPrice: true },
          where: { status: "PAID" },
        }),
      ]);

    return res.json({
      success: true,
      data: {
        totalUsers,
        totalGear,
        totalRentals,
        totalRevenue: revenueData._sum.totalPrice || 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ২. সকল ইউজার তালিকা (সার্চ ও প্যাজিনেশনসহ)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.max(1, parseInt(limit as string, 10) || 10);
    const skip = (pageNum - 1) * take;

    const where: any = {};
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ৩. ইউজার সাসপেন্ড বা অ্যাক্টিভেট করা (Prisma schema: active / suspended)
export const toggleUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isActive, isBlocked } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id: String(id) },
      select: { id: true, status: true, isActive: true },
    });

    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // বর্তমান স্ট্যাটাস পরীক্ষা করে পরবর্তী স্ট্যাটাস নির্ধারণ
    let willSuspend: boolean;
    if (isActive !== undefined) {
      willSuspend = !Boolean(isActive);
    } else if (isBlocked !== undefined) {
      willSuspend = Boolean(isBlocked);
    } else if (status !== undefined) {
      willSuspend = String(status).toLowerCase() === "suspended";
    } else {
      const isCurrentlySuspended =
        String(existingUser.status).toLowerCase() === "suspended" ||
        existingUser.isActive === false;
      willSuspend = !isCurrentlySuspended;
    }

    // schema-র enum অনুযায়ী ছোট হাতের active / suspended
    const nextStatus = willSuspend ? "suspended" : "active";
    const nextIsActive = !willSuspend;

    const updatedUser = await prisma.user.update({
      where: { id: String(id) },
      data: {
        status: nextStatus as any,
        isActive: nextIsActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        isActive: true,
      },
    });

    return res.json({
      success: true,
      message: `User account ${willSuspend ? "suspended" : "activated"} successfully`,
      data: updatedUser,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ৪. প্ল্যাটফর্মের সকল গিয়ার ফেচ (Active / All ফিল্টার এবং প্রোভাইডার সার্চসহ)
export const getAllPlatformGears = async (req: Request, res: Response) => {
  try {
    const {
      search = "",
      availability = "",
      page = "1",
      limit = "10",
    } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.max(1, parseInt(limit as string, 10) || 10);
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (availability === "active") {
      where.isAvailable = true;
    } else if (availability === "inactive") {
      where.isAvailable = false;
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { provider: { name: { contains: q, mode: "insensitive" } } },
        { provider: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [gears, total] = await Promise.all([
      prisma.gearItem.findMany({
        where,
        include: {
          category: true,
          provider: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.gearItem.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        gears,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ৫. অ্যাডমিন সরাসরি যেকোনো গিয়ার মুছে ফেলা
export const adminDeleteGear = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.gearItem.delete({
      where: { id: String(id) },
    });

    return res.json({
      success: true,
      message: "Listing permanently removed by admin.",
    });
  } catch (error: any) {
    if (
      error.code === "P2003" ||
      error.message?.includes("foreign key constraint")
    ) {
      await prisma.gearItem.update({
        where: { id: String(req.params.id) },
        data: { isAvailable: false, stockQuantity: 0 },
      });
      return res.json({
        success: true,
        message: "Active bookings exist. Listing has been marked unavailable.",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ৬. প্ল্যাটফর্মের সকল রেন্টাল অর্ডার ও ট্রানজাকশন মনিটরিং
export const getAllPlatformOrders = async (req: Request, res: Response) => {
  try {
    const { search = "", status = "", page = "1", limit = "10" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.max(1, parseInt(limit as string, 10) || 10);
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (status && String(status).trim()) {
      where.status = String(status).trim().toUpperCase();
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.rentalOrder.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          orderItems: {
            include: {
              gear: {
                select: { id: true, title: true, pricePerDay: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.rentalOrder.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ৭. অ্যাডমিন সরাসরি যেকোনো অর্ডার বাতিল ও স্টক রিস্টোর করা
export const adminCancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.rentalOrder.findUnique({
      where: { id: String(id) },
      include: { orderItems: true },
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status === "CANCELLED") {
      return res
        .status(400)
        .json({ success: false, message: "Order is already cancelled" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.rentalOrder.update({
        where: { id: String(id) },
        data: { status: "CANCELLED" },
      });

      if (order.status !== "RETURNED") {
        for (const item of order.orderItems) {
          await tx.gearItem.update({
            where: { id: item.gearId },
            data: {
              stockQuantity: { increment: 1 },
              isAvailable: true,
            },
          });
        }
      }
    });

    return res.json({
      success: true,
      message: "Order cancelled and gear stock restored successfully.",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};