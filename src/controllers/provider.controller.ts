import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getProviderGears = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const gears = await prisma.gearItem.findMany({
      where: {
        providerId: user.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: gears,
    });
  } catch (error: any) {
    console.error("Provider gears fetch error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch gears" });
  }
};

export const getProviderOrders = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const orders = await prisma.rentalOrder.findMany({
      where: {
        orderItems: {
          some: {
            gear: {
              providerId: user.id,
            },
          },
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        orderItems: {
          include: { gear: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    console.error("Provider orders fetch error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch provider orders" });
  }
};