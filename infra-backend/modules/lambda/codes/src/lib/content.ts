import { libraryArticles } from "../../../../../../packages/domain/src/index";
import type { Market } from "../types";

export function contentArticles(market: Market, topic?: string) {
  return libraryArticles(market, topic);
}
