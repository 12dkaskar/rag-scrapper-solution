import { Controller, Get, HttpCode, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { pingMongo } from "@rag-scrapper/core";

@Controller()
export class HealthController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(@Res() res: Response): Promise<void> {
    const mongoOk = await pingMongo();
    if (!mongoOk) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: "not_ready", mongo: false });
      return;
    }
    res.json({ status: "ready", mongo: true });
  }
}
