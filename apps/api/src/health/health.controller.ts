import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { pingElasticsearch } from "@rag-scrapper/core";

@Controller()
export class HealthController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(@Res() res: Response): Promise<void> {
    const elasticsearchOk = await pingElasticsearch();
    if (!elasticsearchOk) {
      res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json({ status: "not_ready", elasticsearch: false });
      return;
    }
    res.json({ status: "ready", elasticsearch: true });
  }
}
