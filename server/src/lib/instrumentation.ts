import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import config from "@/config";
import logger from "@/lib/logger";

// Enable OTel diagnostic logging only in non-production environments
if (process.env["NODE_ENV"] !== "production") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const tempoUrl = config.tempo.url;
const traceEnv = config.traceEnv;
// Only start instrumentation if TEMPO_URL is provided in the environment
if (tempoUrl) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: traceEnv,
      [ATTR_SERVICE_VERSION]: "1.0",
    }),
    traceExporter: new OTLPTraceExporter({
      url: tempoUrl,
      headers: {},
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
      }),
    ],
  });

  sdk.start();
  logger.info("OpenTelemetry instrumentation started", { traceEnv, tempoUrl });
} else {
  logger.info("OpenTelemetry instrumentation skipped (TEMPO_URL not provided)");
}
