import { createRequire } from "node:module";
import express, { Router } from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OrderStatus, PrismaClient } from "@prisma/client";
import { ZodError, z } from "zod";
import SSLCommerzPayment from "sslcommerz-lts";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (
  mod || (cb((mod = { exports: {} }).exports, mod), (cb = null)),
  mod.exports
);
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function")
    for (
      var keys = __getOwnPropNames(from), i = 0, n = keys.length, key;
      i < n;
      i++
    ) {
      key = keys[i];
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: ((k) => from[k]).bind(null, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
    }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", {
          value: mod,
          enumerable: true,
        })
      : target,
    mod,
  )
);
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region src/config/prisma.ts
var import_main = /* @__PURE__ */ __toESM(
  /* @__PURE__ */ __commonJSMin((exports, module) => {
    const fs = __require("fs");
    const path = __require("path");
    const os = __require("os");
    const crypto = __require("crypto");
    const TIPS = [
      "◈ encrypted .env [www.dotenvx.com]",
      "◈ secrets for agents [www.dotenvx.com]",
      "⌁ auth for agents [www.vestauth.com]",
      "⌘ custom filepath { path: '/custom/path/.env' }",
      "⌘ enable debugging { debug: true }",
      "⌘ override existing { override: true }",
      "⌘ suppress logs { quiet: true }",
      "⌘ multiple files { path: ['.env.local', '.env'] }",
    ];
    function _getRandomTip() {
      return TIPS[Math.floor(Math.random() * TIPS.length)];
    }
    function parseBoolean(value) {
      if (typeof value === "string")
        return !["false", "0", "no", "off", ""].includes(value.toLowerCase());
      return Boolean(value);
    }
    function supportsAnsi() {
      return process.stdout.isTTY;
    }
    function dim(text) {
      return supportsAnsi() ? `\x1b[2m${text}\x1b[0m` : text;
    }
    const LINE =
      /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;
    function parse(src) {
      const obj = {};
      let lines = src.toString();
      lines = lines.replace(/\r\n?/gm, "\n");
      let match;
      while ((match = LINE.exec(lines)) != null) {
        const key = match[1];
        let value = match[2] || "";
        value = value.trim();
        const maybeQuote = value[0];
        value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
        if (maybeQuote === '"') {
          value = value.replace(/\\n/g, "\n");
          value = value.replace(/\\r/g, "\r");
        }
        obj[key] = value;
      }
      return obj;
    }
    function _parseVault(options) {
      options = options || {};
      const vaultPath = _vaultPath(options);
      options.path = vaultPath;
      const result = DotenvModule.configDotenv(options);
      if (!result.parsed) {
        const err = /* @__PURE__ */ new Error(
          `MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`,
        );
        err.code = "MISSING_DATA";
        throw err;
      }
      const keys = _dotenvKey(options).split(",");
      const length = keys.length;
      let decrypted;
      for (let i = 0; i < length; i++)
        try {
          const attrs = _instructions(result, keys[i].trim());
          decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
          break;
        } catch (error) {
          if (i + 1 >= length) throw error;
        }
      return DotenvModule.parse(decrypted);
    }
    function _warn(message) {
      console.error(`⚠ ${message}`);
    }
    function _debug(message) {
      console.log(`┆ ${message}`);
    }
    function _log(message) {
      console.log(`◇ ${message}`);
    }
    function _dotenvKey(options) {
      if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0)
        return options.DOTENV_KEY;
      if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0)
        return process.env.DOTENV_KEY;
      return "";
    }
    function _instructions(result, dotenvKey) {
      let uri;
      try {
        uri = new URL(dotenvKey);
      } catch (error) {
        if (error.code === "ERR_INVALID_URL") {
          const err = /* @__PURE__ */ new Error(
            "INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development",
          );
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        }
        throw error;
      }
      const key = uri.password;
      if (!key) {
        const err = /* @__PURE__ */ new Error(
          "INVALID_DOTENV_KEY: Missing key part",
        );
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environment = uri.searchParams.get("environment");
      if (!environment) {
        const err = /* @__PURE__ */ new Error(
          "INVALID_DOTENV_KEY: Missing environment part",
        );
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
      const ciphertext = result.parsed[environmentKey];
      if (!ciphertext) {
        const err = /* @__PURE__ */ new Error(
          `NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`,
        );
        err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
        throw err;
      }
      return {
        ciphertext,
        key,
      };
    }
    function _vaultPath(options) {
      let possibleVaultPath = null;
      if (options && options.path && options.path.length > 0)
        if (Array.isArray(options.path)) {
          for (const filepath of options.path)
            if (fs.existsSync(filepath))
              possibleVaultPath = filepath.endsWith(".vault")
                ? filepath
                : `${filepath}.vault`;
        } else
          possibleVaultPath = options.path.endsWith(".vault")
            ? options.path
            : `${options.path}.vault`;
      else possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
      if (fs.existsSync(possibleVaultPath)) return possibleVaultPath;
      return null;
    }
    function _resolveHome(envPath) {
      return envPath[0] === "~"
        ? path.join(os.homedir(), envPath.slice(1))
        : envPath;
    }
    function _configVault(options) {
      const debug = parseBoolean(
        process.env.DOTENV_CONFIG_DEBUG || (options && options.debug),
      );
      const quiet = parseBoolean(
        process.env.DOTENV_CONFIG_QUIET || (options && options.quiet),
      );
      if (debug || !quiet) _log("loading env from encrypted .env.vault");
      const parsed = DotenvModule._parseVault(options);
      let processEnv = process.env;
      if (options && options.processEnv != null)
        processEnv = options.processEnv;
      DotenvModule.populate(processEnv, parsed, options);
      return { parsed };
    }
    function configDotenv(options) {
      const dotenvPath = path.resolve(process.cwd(), ".env");
      let encoding = "utf8";
      let processEnv = process.env;
      if (options && options.processEnv != null)
        processEnv = options.processEnv;
      let debug = parseBoolean(
        processEnv.DOTENV_CONFIG_DEBUG || (options && options.debug),
      );
      let quiet = parseBoolean(
        processEnv.DOTENV_CONFIG_QUIET || (options && options.quiet),
      );
      if (options && options.encoding) encoding = options.encoding;
      else if (debug)
        _debug("no encoding is specified (UTF-8 is used by default)");
      let optionPaths = [dotenvPath];
      if (options && options.path)
        if (!Array.isArray(options.path))
          optionPaths = [_resolveHome(options.path)];
        else {
          optionPaths = [];
          for (const filepath of options.path)
            optionPaths.push(_resolveHome(filepath));
        }
      let lastError;
      const parsedAll = {};
      for (const path of optionPaths)
        try {
          const parsed = DotenvModule.parse(
            fs.readFileSync(path, { encoding }),
          );
          DotenvModule.populate(parsedAll, parsed, options);
        } catch (e) {
          if (debug) _debug(`failed to load ${path} ${e.message}`);
          lastError = e;
        }
      const populated = DotenvModule.populate(processEnv, parsedAll, options);
      debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
      quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
      if (debug || !quiet) {
        const keysCount = Object.keys(populated).length;
        const shortPaths = [];
        for (const filePath of optionPaths)
          try {
            const relative = path.relative(process.cwd(), filePath);
            shortPaths.push(relative);
          } catch (e) {
            if (debug) _debug(`failed to load ${filePath} ${e.message}`);
            lastError = e;
          }
        _log(
          `injected env (${keysCount}) from ${shortPaths.join(",")} ${dim(`// tip: ${_getRandomTip()}`)}`,
        );
      }
      if (lastError)
        return {
          parsed: parsedAll,
          error: lastError,
        };
      else return { parsed: parsedAll };
    }
    function config(options) {
      if (_dotenvKey(options).length === 0)
        return DotenvModule.configDotenv(options);
      const vaultPath = _vaultPath(options);
      if (!vaultPath) {
        _warn(
          `you set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}`,
        );
        return DotenvModule.configDotenv(options);
      }
      return DotenvModule._configVault(options);
    }
    function decrypt(encrypted, keyStr) {
      const key = Buffer.from(keyStr.slice(-64), "hex");
      let ciphertext = Buffer.from(encrypted, "base64");
      const nonce = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(-16);
      ciphertext = ciphertext.subarray(12, -16);
      try {
        const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
        aesgcm.setAuthTag(authTag);
        return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
      } catch (error) {
        const isRange = error instanceof RangeError;
        const invalidKeyLength = error.message === "Invalid key length";
        const decryptionFailed =
          error.message === "Unsupported state or unable to authenticate data";
        if (isRange || invalidKeyLength) {
          const err = /* @__PURE__ */ new Error(
            "INVALID_DOTENV_KEY: It must be 64 characters long (or more)",
          );
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        } else if (decryptionFailed) {
          const err = /* @__PURE__ */ new Error(
            "DECRYPTION_FAILED: Please check your DOTENV_KEY",
          );
          err.code = "DECRYPTION_FAILED";
          throw err;
        } else throw error;
      }
    }
    function populate(processEnv, parsed, options = {}) {
      const debug = Boolean(options && options.debug);
      const override = Boolean(options && options.override);
      const populated = {};
      if (typeof parsed !== "object") {
        const err = /* @__PURE__ */ new Error(
          "OBJECT_REQUIRED: Please check the processEnv argument being passed to populate",
        );
        err.code = "OBJECT_REQUIRED";
        throw err;
      }
      for (const key of Object.keys(parsed))
        if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
          if (override === true) {
            processEnv[key] = parsed[key];
            populated[key] = parsed[key];
          }
          if (debug)
            if (override === true)
              _debug(`"${key}" is already defined and WAS overwritten`);
            else _debug(`"${key}" is already defined and was NOT overwritten`);
        } else {
          processEnv[key] = parsed[key];
          populated[key] = parsed[key];
        }
      return populated;
    }
    const DotenvModule = {
      configDotenv,
      _configVault,
      _parseVault,
      config,
      decrypt,
      parse,
      populate,
    };
    module.exports.configDotenv = DotenvModule.configDotenv;
    module.exports._configVault = DotenvModule._configVault;
    module.exports._parseVault = DotenvModule._parseVault;
    module.exports.config = DotenvModule.config;
    module.exports.decrypt = DotenvModule.decrypt;
    module.exports.parse = DotenvModule.parse;
    module.exports.populate = DotenvModule.populate;
    module.exports = DotenvModule;
  })(),
  1,
);
const prisma = new PrismaClient();
//#endregion
//#region src/validations/auth.validation.ts
const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["customer", "provider", "admin"]),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const gearSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  brand: z.string().min(1),
  pricePerDay: z.number().positive(),
  stockQuantity: z.number().int().nonnegative(),
  categoryId: z.string().uuid(),
});
z.object({
  startDate: z.string(),
  endDate: z.string(),
  gearItems: z
    .array(
      z.object({
        gearId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});
//#endregion
//#region src/utils/AppError.ts
var AppError = class extends Error {
  statusCode;
  errorDetails;
  constructor(statusCode, message, errorDetails = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorDetails = errorDetails;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
};
//#endregion
//#region src/controllers/auth.controller.ts
const registerUser = async (req, res) => {
  const bodyData = req.body || {};
  const { name, email, password, role } = registerSchema.parse(bodyData);
  if (await prisma.user.findUnique({ where: { email } }))
    throw new AppError(400, "User already exists with this email.");
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
    },
  });
  return res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};
const loginUser = async (req, res) => {
  const { email, password } = loginSchema.parse(req.body || {});
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(400, "Invalid credentials");
  if (user.status === "suspended")
    throw new AppError(403, "Your account has been suspended");
  if (!(await bcrypt.compare(password, user.password)))
    throw new AppError(400, "Invalid credentials");
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "1d" },
  );
  return res.json({
    success: true,
    message: "Login successful",
    token,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};
//#endregion
//#region src/routes/auth.routes.ts
const router$4 = Router();
router$4.post("/register", registerUser);
router$4.post("/login", loginUser);
//#endregion
//#region src/controllers/gear.controller.ts
const getGears = async (req, res) => {
  const { category, brand, minPrice, maxPrice } = req.query;
  const gears = await prisma.gearItem.findMany({
    where: {
      isAvailable: true,
      brand: brand ? String(brand) : void 0,
      ...(category && { category: { name: String(category) } }),
      ...((minPrice || maxPrice) && {
        pricePerDay: {
          gte: minPrice ? Number(minPrice) : void 0,
          lte: maxPrice ? Number(maxPrice) : void 0,
        },
      }),
    },
    include: { category: true },
  });
  res.json({
    success: true,
    data: gears,
  });
};
const createGear = async (req, res) => {
  const validatedData = gearSchema.parse(req.body || {});
  const user = req.user;
  const gear = await prisma.gearItem.create({
    data: {
      ...validatedData,
      providerId: user.id,
    },
  });
  res.status(201).json({
    success: true,
    data: gear,
  });
};
const updateGear = async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const gear = await prisma.gearItem.findUnique({ where: { id: String(id) } });
  if (!gear) throw new AppError(404, "Gear item not found");
  if (gear.providerId !== user.id) throw new AppError(403, "Unauthorized");
  const updated = await prisma.gearItem.update({
    where: { id: String(id) },
    data: req.body,
  });
  res.json({
    success: true,
    data: updated,
  });
};
const deleteGear = async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const gear = await prisma.gearItem.findUnique({ where: { id: String(id) } });
  if (!gear) throw new AppError(404, "Gear item not found");
  if (gear.providerId !== user.id) throw new AppError(403, "Unauthorized");
  await prisma.gearItem.delete({ where: { id: String(id) } });
  res.json({
    success: true,
    message: "Gear removed successfully",
  });
};
//#endregion
//#region src/middlewares/auth.middleware.ts
const protect = (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  )
    token = req.headers.authorization.split(" ")[1];
  if (!token)
    throw new AppError(
      401,
      "You are not logged in. Please log in to get access.",
    );
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "secret");
    next();
  } catch (error) {
    throw new AppError(
      401,
      "Token is invalid or expired. Please log in again.",
    );
  }
};
const restrictTo = (...roles) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !roles.includes(user.role))
      throw new AppError(
        403,
        "You do not have permission to perform this action.",
      );
    next();
  };
};
//#endregion
//#region src/routes/gear.routes.ts
const router$3 = Router();
router$3.post("/categories", protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    const slug = name.toLowerCase().trim().replace(/ +/g, "-");
    const db = prisma;
    const newCategory = await (db.category || db.Category).create({
      data: {
        name,
        slug,
      },
    });
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
router$3.get("/categories", async (req, res) => {
  try {
    const db = prisma;
    const categories = await (db.category || db.Category).findMany();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
router$3.get("/", getGears);
router$3.post("/", protect, restrictTo("provider"), createGear);
router$3.put("/:id", protect, restrictTo("provider"), updateGear);
router$3.delete("/:id", protect, restrictTo("provider"), deleteGear);
//#endregion
//#region src/controllers/rental.controller.ts
const store_id$1 = process.env.SSL_STORE_ID || "testbox";
const store_passwd$1 = process.env.SSL_STORE_PASSWORD || "qwerty";
const is_live$1 = process.env.SSL_IS_LIVE === "true";
const createRentalOrder = async (req, res) => {
  const { startDate, endDate, gearItems } = req.body || {};
  const user = req.user;
  if (!startDate || !endDate || !gearItems || gearItems.length === 0)
    throw new AppError(400, "Missing required fields for rental order");
  const days = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) /
      (1e3 * 60 * 60 * 24),
  );
  if (days <= 0) throw new AppError(400, "End date must be after start date");
  let total = 0;
  for (const item of gearItems) {
    const gear = await prisma.gearItem.findUnique({
      where: { id: item.gearId },
    });
    if (!gear || gear.stockQuantity < item.quantity)
      throw new AppError(
        400,
        `Item "${gear?.title || "Unknown"}" is out of stock`,
      );
    total += gear.pricePerDay * item.quantity * days;
  }
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.rentalOrder.create({
      data: {
        customerId: user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalPrice: total,
        status: OrderStatus.PLACED,
      },
    });
    for (const item of gearItems) {
      await tx.orderItem.create({
        data: {
          orderId: newOrder.id,
          gearId: item.gearId,
          quantity: item.quantity,
        },
      });
      await tx.gearItem.update({
        where: { id: item.gearId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }
    return newOrder;
  });
  const tran_id = `TRAN_${order.id.slice(0, 8)}_${Date.now()}`;
  const paymentData = {
    total_amount: total,
    currency: "BDT",
    tran_id,
    success_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/success/${order.id}?tran_id=${tran_id}`,
    fail_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/fail/${order.id}?tran_id=${tran_id}`,
    cancel_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/cancel/${order.id}?tran_id=${tran_id}`,
    ipn_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/ipn`,
    shipping_method: "NO",
    product_name: `GearUp Rental Order #${order.id}`,
    product_category: "Gear Rental",
    product_profile: "general",
    cus_name: user?.name || "Customer Name",
    cus_email: user?.email || "customer@example.com",
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_postcode: "1207",
    cus_country: "Bangladesh",
    cus_phone: "01700000000",
  };
  const sslResponse = await new SSLCommerzPayment(
    store_id$1,
    store_passwd$1,
    is_live$1,
  ).init(paymentData);
  if (!sslResponse?.GatewayPageURL)
    throw new AppError(500, "Failed to create SSLCommerz payment session");
  res.status(201).json({
    success: true,
    message: "Order placed successfully. Complete payment via SSLCommerz link.",
    orderId: order.id,
    checkoutUrl: sslResponse.GatewayPageURL,
  });
};
//#endregion
//#region src/routes/rental.routes.ts
const router$2 = Router();
router$2.post("/", protect, createRentalOrder);
//#endregion
//#region src/controllers/payment.controller.ts
const store_id = process.env.SSL_STORE_ID || "testbox";
const store_passwd = process.env.SSL_STORE_PASSWORD || "qwerty";
const is_live = process.env.SSL_IS_LIVE === "true";
const initiatePayment = async (req, res) => {
  const orderId = String(req.params.orderId || "");
  const user = req.user;
  const order = await prisma.rentalOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, "Rental order not found");
  const tran_id = `TRAN_${order.id.slice(0, 8)}_${Date.now()}`;
  const data = {
    total_amount: order.totalPrice,
    currency: "BDT",
    tran_id,
    success_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/success/${order.id}?tran_id=${tran_id}`,
    fail_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/fail/${order.id}?tran_id=${tran_id}`,
    cancel_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/cancel/${order.id}?tran_id=${tran_id}`,
    ipn_url: `${process.env.SERVER_BASE_URL || "http://localhost:5000"}/api/payments/ipn`,
    shipping_method: "NO",
    product_name: `GearUp Rental Order #${order.id}`,
    product_category: "Gear Rental",
    product_profile: "general",
    cus_name: user?.name || "Customer Name",
    cus_email: user?.email || "customer@example.com",
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_postcode: "1207",
    cus_country: "Bangladesh",
    cus_phone: "01700000000",
  };
  const apiResponse = await new SSLCommerzPayment(
    store_id,
    store_passwd,
    is_live,
  ).init(data);
  if (apiResponse?.GatewayPageURL)
    res.status(200).json({
      success: true,
      message: "Payment session initiated",
      gatewayUrl: apiResponse.GatewayPageURL,
      tran_id,
    });
  else throw new AppError(500, "Failed to create SSLCommerz payment session");
};
const paymentSuccess = async (req, res) => {
  const orderId = String(req.params.orderId || "");
  const { val_id, tran_id } = req.body;
  const validationResponse = await new SSLCommerzPayment(
    store_id,
    store_passwd,
    is_live,
  ).validate({ val_id });
  if (
    validationResponse?.status === "VALID" ||
    validationResponse?.status === "VALIDATED"
  ) {
    await prisma.rentalOrder.update({
      where: { id: orderId },
      data: { status: "PAID" },
    });
    return res.redirect(
      `${process.env.CLIENT_BASE_URL || "https://gear-up-beta.vercel.app"}/payment/success?orderId=${orderId}&tran_id=${tran_id}`,
    );
  }
  return res.redirect(
    `${process.env.CLIENT_BASE_URL || "https://gear-up-beta.vercel.app"}/payment/fail?orderId=${orderId}`,
  );
};
const paymentFail = async (req, res) => {
  const orderId = String(req.params.orderId || "");
  await prisma.rentalOrder.update({
    where: { id: orderId },
    data: { status: "FAILED" },
  });
  return res.redirect(
    `${process.env.CLIENT_BASE_URL || "https://gear-up-beta.vercel.app"}/payment/fail?orderId=${orderId}`,
  );
};
const paymentCancel = async (req, res) => {
  const orderId = String(req.params.orderId || "");
  await prisma.rentalOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
  return res.redirect(
    `${process.env.CLIENT_BASE_URL || "https://gear-up-beta.vercel.app"}/payment/cancel?orderId=${orderId}`,
  );
};
const paymentIPN = async (req, res) => {
  const { status, val_id } = req.body;
  if (status === "VALID")
    await new SSLCommerzPayment(store_id, store_passwd, is_live).validate({
      val_id,
    });
  res.status(200).send("IPN Received");
};
const getPaymentStatus = async (req, res) => {
  const orderId = String(req.params.orderId || "");
  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalPrice: true,
      status: true,
      createdAt: true,
    },
  });
  if (!order) throw new AppError(404, "Order not found");
  res.status(200).json({
    success: true,
    data: {
      orderId: order.id,
      amount: order.totalPrice,
      paymentStatus: order.status,
      createdAt: order.createdAt,
    },
  });
};
//#endregion
//#region src/routes/payment.routes.ts
const router$1 = Router();
router$1.post("/initiate/:orderId", protect, initiatePayment);
router$1.post("/success/:orderId", paymentSuccess);
router$1.post("/fail/:orderId", paymentFail);
router$1.post("/cancel/:orderId", paymentCancel);
router$1.post("/ipn", paymentIPN);
router$1.get("/status/:orderId", protect, getPaymentStatus);
//#endregion
//#region src/routes/index.ts
const router = Router();
router.use("/auth", router$4);
router.use("/gear", router$3);
router.use("/rentals", router$2);
router.use("/payments", router$1);
//#endregion
//#region src/middlewares/error.middleware.ts
const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorDetails = err.errorDetails || null;
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation Error";
    errorDetails = err.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
  }
  if (err.code === "P2002") {
    statusCode = 400;
    message = "Duplicate field value entered";
    errorDetails = { target: err.meta?.target };
  }
  res.status(statusCode).json({
    success: false,
    message,
    errorDetails,
  });
};
//#endregion
//#region src/server.ts
import_main.default.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.get("/", (req, res) => {
  res.send("GearUp Running Successful");
});
app.use("/api", router);
app.use(globalErrorHandler);
const PORT = process.env.PORT || 5e3;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
//#endregion
export {};
