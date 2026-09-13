import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";

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
      where.OR = [
        { name: { contains: String(search).trim(), mode: "insensitive" } },
        { email: { contains: String(search).trim(), mode: "insensitive" } },
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

// ৩. ইউজার সাসপেন্ড বা অ্যাক্টিভেট করা
export const toggleUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isActive, isBlocked } = req.body;

    const updatePayload: any = {};

    if (status !== undefined) {
      updatePayload.status = status;
    } else if (isBlocked !== undefined) {
      updatePayload.status = isBlocked ? "SUSPENDED" : "ACTIVE";
    }

    if (isActive !== undefined) {
      updatePayload.isActive = Boolean(isActive);
    } else if (isBlocked !== undefined) {
      updatePayload.isActive = !Boolean(isBlocked);
    }

    const updatedUser = await prisma.user.update({
      where: { id: String(id) },
      data: updatePayload,
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
      message: `User status updated successfully`,
      data: updatedUser,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ৪. প্ল্যাটফর্মের সকল গিয়ার ফেচ (Active / All ফিল্টারসহ)
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

    // 🎯 Active / Inactive ফিল্টারিং লজিক
    if (availability === "active") {
      where.isAvailable = true;
    } else if (availability === "inactive") {
      where.isAvailable = false;
    }

    if (search && String(search).trim()) {
      where.OR = [
        { title: { contains: String(search).trim(), mode: "insensitive" } },
        { brand: { contains: String(search).trim(), mode: "insensitive" } },
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
    // Foreign key constraint থাকলে ইনঅ্যাক্টিভ করে দেওয়া
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

    // স্ট্যাটাস ফিল্টারিং
    if (status && String(status).trim()) {
      where.status = String(status).trim().toUpperCase();
    }

    // কাস্টমার নাম, ইমেইল বা অর্ডার আইডি দিয়ে সার্চ
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
