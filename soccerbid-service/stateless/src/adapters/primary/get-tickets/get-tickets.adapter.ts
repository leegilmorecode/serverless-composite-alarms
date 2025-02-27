import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { TicketResponses } from '@dto/ticket';
import { errorHandler, getHeaders, logger } from '@shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { config } from '@config';
import { ValidationError } from '@errors/validation-error';
import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import { getTicketsUseCase } from '@use-cases/get-tickets';

const tracer = new Tracer();
const metrics = new Metrics();

const stage = config.get('stage');

export const getTicketsAdapter = async ({
  queryStringParameters,
}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (
      queryStringParameters?.direction &&
      queryStringParameters.direction !== 'asc' &&
      queryStringParameters.direction !== 'desc'
    ) {
      throw new ValidationError('if set, direction should be asc or desc');
    }

    const nextToken = queryStringParameters?.nextToken
      ? queryStringParameters.nextToken
      : null;

    const ascending = queryStringParameters?.direction
      ? queryStringParameters.direction === 'asc'
        ? true
        : false
      : true;

    const tickets: TicketResponses = await getTicketsUseCase(
      nextToken,
      ascending,
    );

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
