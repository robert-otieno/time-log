import "server-only";

import { Resend } from "resend";
import { parseResendEnvironment } from "@/lib/resend-config";

let client: Resend | undefined;

export function getResendClient() {
  if (!client) client = new Resend(parseResendEnvironment(process.env).apiKey);
  return client;
}
