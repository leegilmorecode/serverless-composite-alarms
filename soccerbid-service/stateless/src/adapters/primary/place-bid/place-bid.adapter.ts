import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { BidResponse } from '@dto/bid';
import { errorHandler, getHeaders, logger, schemaValidator } from '@shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { config } from '@config';
import { PlaceBid } from '@dto/place-bid';
import { ValidationError } from '@errors/validation-error';
import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import { placeBidUseCase } from '@use-cases/place-bid';
import { schema } from './place-bid.schema';

const tracer = new Tracer();
const metrics = new Metrics();

const stage = config.get('stage');

export const placeBidAdapter = async ({
  body,
}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!body) throw new ValidationError('no payload body');

    const bid = JSON.parse(body) as PlaceBid;

    schemaValidator(schema, bid);

    const created: BidResponse = await placeBidUseCase(bid);

    metrics.addMetric('SuccessfulPlaceBid', MetricUnit.Count, 1);

    return {
      statusCode: 200,
      body: JSON.stringify(created),
      headers: getHeaders(stage),
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) errorMessage = error.message;
    logger.error(errorMessage);

    metrics.addMetric('PlaceBidError', MetricUnit.Count, 1);

    return errorHandler(error);
  }
};

export const handler = middy(placeBidAdapter)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics))
  .use(httpErrorHandler());
