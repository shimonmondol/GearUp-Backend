import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";

// 1. For Admin (getAllOrders)
export const getAllOrders = async (req: Request, res: Response) => {
  const orders = await prisma.rentalOrder.findMany({
    include: {
      customer: {
        select: { id: true, name: true, email: true },
      },
      orderItems: {
        include: { gear: true },
      },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    success: true,
    message: "All rental orders fetched successfully",
    data: orders,
  });
};

// 2. For Customer (createOrder)
export const createOrder = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { items, startDate, endDate } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError(400, "At least one gear item is required to place an order");
  }

  if (!startDate || !endDate) {
    throw new AppError(400, "Start date and end date are required");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    throw new AppError(400, "End date must be after start date");
  }

  // Calculate rental duration in days
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const rentalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let totalPrice = 0;
  const orderItemsData = [];

  for (const item of items) {
    const gear = await prisma.gearItem.findUnique({
      where: { id: item.gearId },
    });

    if (!gear) {
      throw new AppError(404, `Gear with ID ${item.gearId} not found`);
    }

    const qty = item.quantity || 1;
    totalPrice += gear.pricePerDay * qty * rentalDays;

    orderItemsData.push({
      gearId: gear.id,
      quantity: qty,
    });
  }

  // Transaction to create order and items
  const newOrder = await prisma.rentalOrder.create({
    data: {
      customerId: user.id,
      startDate: start,
      endDate: end,
      totalPrice,
      status: OrderStatus.PLACED,
      orderItems: {
        create: orderItemsData,
      },
    },
    include: {
      orderItems: { include: { gear: true } },
    },
  });

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: newOrder,
  });
};

// 3. For Customer (getMyOrders)
export const getMyOrders = async (req: Request, res: Response) => {
  const user = (req as any).user;

  const myOrders = await prisma.rentalOrder.findMany({
    where: { customerId: user.id },
    include: {
      orderItems: {
        include: { gear: true },
      },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    success: true,
    message: "My orders fetched successfully",
    data: myOrders,
  });
};

// 4. For Provider (getProviderOrders - GET /api/orders/provider)
export const getProviderOrders = async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!user?.id) {
    throw new AppError(401, "Unauthorized! User not identified.");
  }

  // প্রোভাইডারের gearItem যেসব অর্ডারে আছে সেগুলো খুঁজে আনা
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
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      orderItems: {
        include: {
          gear: true,
        },
      },
      payments: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.status(200).json({
    success: true,
    message: "Provider incoming orders fetched successfully",
    data: orders,
  });
};

// 5. Update Order (Customer updates dates / Admin updates status)
export const updateOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { startDate, endDate, status } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: String(id) },
    include: { orderItems: { include: { gear: true } } },
  });

  if (!order) {
    throw new AppError(404, "Rental order not found");
  }

  // Admin status update logic
  if (user.role === "admin" || user.role === "ADMIN") {
    const updatedOrder = await prisma.rentalOrder.update({
      where: { id: String(id) },
      data: {
        ...(status && { status: status as OrderStatus }),
      },
    });

    return res.json({
      success: true,
      message: "Order updated successfully by Admin",
      data: updatedOrder,
    });
  }

  // Customer authorization & status check
  if (order.customerId !== user.id) {
    throw new AppError(403, "You are not authorized to update this order");
  }

  if (order.status !== OrderStatus.PLACED) {
    throw new AppError(400, "Cannot update an order that is not in PLACED state");
  }

  let updateData: any = {};

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new AppError(400, "End date must be after start date");
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const rentalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let newTotalPrice = 0;
    for (const item of order.orderItems) {
      newTotalPrice += item.gear.pricePerDay * item.quantity * rentalDays;
    }

    updateData.startDate = start;
    updateData.endDate = end;
    updateData.totalPrice = newTotalPrice;
  }

  const updatedOrder = await prisma.rentalOrder.update({
    where: { id: String(id) },
    data: updateData,
  });

  res.json({
    success: true,
    message: "Order updated successfully",
    data: updatedOrder,
  });
};

// 6. Cancel Order (Customer or Admin)
export const cancelOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: String(id) },
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (order.customerId !== user.id && user.role !== "admin" && user.role !== "ADMIN") {
    throw new AppError(403, "You are not authorized to cancel this order");
  }

  if (order.status !== OrderStatus.PLACED) {
    throw new AppError(400, "Only PLACED orders can be cancelled");
  }

  const cancelledOrder = await prisma.rentalOrder.update({
    where: { id: String(id) },
    data: { status: OrderStatus.CANCELLED },
  });

  res.json({
    success: true,
    message: "Order cancelled successfully",
    data: cancelledOrder,
  });
};

// 7. Delete Order Permanently
export const deleteOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: String(id) },
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (
    user.role !== "admin" &&
    user.role !== "ADMIN" &&
    (order.customerId !== user.id || order.status !== OrderStatus.PLACED)
  ) {
    throw new AppError(403, "You can only delete your own PLACED orders");
  }

  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: String(id) } }),
    prisma.payment.deleteMany({ where: { orderId: String(id) } }),
    prisma.rentalOrder.delete({ where: { id: String(id) } }),
  ]);

  res.json({
    success: true,
    message: "Order deleted permanently",
  });
};