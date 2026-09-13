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

    // স্ট্যাটাস ও অ্যাক্টিভেশনের মান সেট করা
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