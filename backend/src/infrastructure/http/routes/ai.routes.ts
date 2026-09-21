import { Router } from "express";
import { z } from "zod";
import { AiPredictionService } from "../../../domain/games/services/AiPredictionService.js";

const router = Router();
const service = new AiPredictionService();

router.post("/predict", async (req, res, next) => {
  try {
    const body = z
      .object({
        quantity: z.number().int().min(1).max(20).default(5),
        numbersPerGame: z.number().int().min(15).max(20).default(15),
        includeCaixa: z.boolean().default(true),
      })
      .strict()
      .parse(req.body ?? {});
    res.json(await service.predict(body));
  } catch (error) {
    next(error);
  }
});

export { router as aiRoutes };
