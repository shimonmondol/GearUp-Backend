import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";

// ১. অ্যাডমিন গ্লোবাল স্ট্যাটস
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const [totalUsers, activeGear, totalRentals, revenueData] = await Promise.all([
      prisma.user.count(),
      prisma.gearItem.count({ where: { isAvailable: true } }),
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
        activeGear,
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
    const pageNum = Math.max(1, parseInt(search as string, 10) || Number(page));
    const take = Math.max(1, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * take;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { email: { contains: String(search), mode: "insensitive" } },
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
          isBlocked: true,
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
    const { isBlocked } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: String(id) },
      data: { isBlocked: Boolean(isBlocked) },
      select: { id: true, name: true, email: true, isBlocked: true },
    });

    return res.json({
      success: true,
      message: `User status updated to ${updatedUser.isBlocked ? "Suspended" : "Active"}`,
      data: updatedUser,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};