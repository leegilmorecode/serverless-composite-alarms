import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { errorHandler, getHeaders, logger } from '@shared';

import { Tickets } from '@dto/ticket';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { config } from '@config';
import { getTicketsUseCase } from '@use-cases/get-tickets';
import httpErrorHandler from '@middy/http-error-handler';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const tracer = new Tracer();
const metrics = new Metrics();

const stage = config.get('stage');

export const getTicketsAdapter =
  async ({}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const tickets: Tickets = await getTicketsUseCase();

      metrics.addMetric('SuccessfulGetTickets', MetricUnit.Count, 1);

      return {
        statusCode: 200,
        body: JSON.stringify(tickets),
        headers: getHeaders(stage),
      };
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) errorMessage = error.message;
      logger.error(errorMessage);

      metrics.addMetric('GetTicketsError', MetricUnit.Count, 1);

      return errorHandler(error);
    }
  };

export const handler = middy(getTicketsAdapter)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics))
  .use(httpErrorHandler());
