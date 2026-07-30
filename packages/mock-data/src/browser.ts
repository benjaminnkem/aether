import { setupWorker } from "msw/browser";
import { handlers, mockTransport } from "./index";
export const worker = setupWorker(...handlers);
export { mockTransport };
